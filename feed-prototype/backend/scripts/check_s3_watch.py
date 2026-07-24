"""S3 watch worker orchestration check (v1.2.2).

Exercises `process_s3_incoming` (discovery -> limit -> per-batch processing ->
health/stats, plus the watch loop and graceful shutdown) with an injected fake
`process_fn` and session factory, so it runs with no DB, no MinIO, no boto3.
`process_batch` itself is covered by check_s3_ingest_tracking.

Usage (from feed-prototype/backend):

    python -m scripts.check_s3_watch
"""

from __future__ import annotations

import threading

from app.services.process_s3_incoming import (
    WorkerHealth,
    process_once,
    watch,
)
from app.services.s3_ingest import BatchOutcome

from scripts.check_s3_ingest import CONFIG, FakeObjectStore, seed_valid_batch


class DummySession:
    def close(self) -> None:
        pass


def dummy_factory() -> DummySession:
    return DummySession()


def store_with(n: int) -> FakeObjectStore:
    store = FakeObjectStore()
    for i in range(n):
        seed_valid_batch(store, f"batch_{i:02d}")
    return store


def outcome_for(discovered, status="completed", **kw) -> BatchOutcome:
    return BatchOutcome(batch_external_id=discovered.batch_external_id, status=status, **kw)


def check_process_once_aggregates() -> None:
    store = store_with(3)
    calls = []

    def process_fn(session, store_, config, d, settings):
        calls.append(d.batch_external_id)
        # batch_00 completed, batch_01 failed, batch_02 skipped
        idx = int(d.batch_external_id.split("_")[1])
        status = ["completed", "failed", "skipped"][idx]
        return outcome_for(d, status, error_code="boom" if status == "failed" else None)

    health = WorkerHealth()
    result = process_once(
        store, CONFIG, None, session_factory=dummy_factory, process_fn=process_fn, health=health
    )

    assert result.discovered_count == 3
    assert calls == ["batch_00", "batch_01", "batch_02"], calls
    assert result.count("completed") == 1
    assert result.count("failed") == 1
    assert result.count("skipped") == 1
    assert health.polls == 1
    assert health.total_completed == 1
    assert health.total_failed == 1
    assert health.total_skipped == 1
    assert health.last_poll_at is not None
    assert health.last_success_at is not None
    assert health.last_error_at is not None
    assert health.last_error_message == "boom"
    assert health.currently_processing_batch is None  # reset after poll


def check_limit_applied() -> None:
    store = store_with(5)
    calls = []

    def process_fn(session, store_, config, d, settings):
        calls.append(d.batch_external_id)
        return outcome_for(d, "completed")

    result = process_once(
        store, CONFIG, None, limit=2, session_factory=dummy_factory, process_fn=process_fn
    )
    assert result.discovered_count == 2
    assert calls == ["batch_00", "batch_01"], calls


def check_batch_crash_isolated() -> None:
    store = store_with(3)

    def process_fn(session, store_, config, d, settings):
        if d.batch_external_id == "batch_01":
            raise RuntimeError("kaboom")
        return outcome_for(d, "completed")

    health = WorkerHealth()
    result = process_once(
        store, CONFIG, None, session_factory=dummy_factory, process_fn=process_fn, health=health
    )
    # all three produced an outcome; the crash became a failed outcome
    assert len(result.outcomes) == 3
    assert result.count("completed") == 2
    assert result.count("failed") == 1
    crashed = [o for o in result.outcomes if o.status == "failed"][0]
    assert crashed.error_code == "worker_error"
    assert health.total_completed == 2 and health.total_failed == 1


def check_watch_stops_after_polls() -> None:
    store = store_with(1)
    stop_event = threading.Event()
    poll_marker = {"n": 0}

    def process_fn(session, store_, config, d, settings):
        poll_marker["n"] += 1
        if poll_marker["n"] >= 3:
            stop_event.set()  # ask the loop to stop
        return outcome_for(d, "completed")

    health = watch(
        store,
        CONFIG,
        None,
        interval=0,
        session_factory=dummy_factory,
        process_fn=process_fn,
        stop_event=stop_event,
        install_signals=False,
    )
    assert poll_marker["n"] >= 3
    assert health.polls >= 3
    assert stop_event.is_set()


def check_watch_graceful_mid_poll() -> None:
    # 3 batches; stop is requested during the first batch -> remaining batches in
    # that poll are skipped (graceful shutdown between batches).
    store = store_with(3)
    stop_event = threading.Event()
    processed = []

    def process_fn(session, store_, config, d, settings):
        processed.append(d.batch_external_id)
        stop_event.set()
        return outcome_for(d, "completed")

    watch(
        store,
        CONFIG,
        None,
        interval=0,
        session_factory=dummy_factory,
        process_fn=process_fn,
        stop_event=stop_event,
        install_signals=False,
    )
    assert processed == ["batch_00"], processed  # broke out after the first batch


def check_watch_prestopped_noop() -> None:
    store = store_with(2)
    stop_event = threading.Event()
    stop_event.set()  # already stopped before watch starts
    calls = []

    def process_fn(session, store_, config, d, settings):
        calls.append(d.batch_external_id)
        return outcome_for(d, "completed")

    health = watch(
        store,
        CONFIG,
        None,
        interval=0,
        session_factory=dummy_factory,
        process_fn=process_fn,
        stop_event=stop_event,
        install_signals=False,
    )
    assert calls == []
    assert health.polls == 0


CHECKS = [
    ("process_once aggregates + health", check_process_once_aggregates),
    ("limit applied", check_limit_applied),
    ("one batch crash isolated", check_batch_crash_isolated),
    ("watch stops after N polls", check_watch_stops_after_polls),
    ("watch graceful shutdown mid-poll", check_watch_graceful_mid_poll),
    ("watch pre-stopped is a no-op", check_watch_prestopped_noop),
]


def main() -> int:
    passed = 0
    failed = 0
    for name, fn in CHECKS:
        try:
            fn()
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[FAIL] {name}: {type(exc).__name__}: {exc}")
        else:
            passed += 1
            print(f"[ok]   {name}")
    print(f"\ncheck_s3_watch: {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
