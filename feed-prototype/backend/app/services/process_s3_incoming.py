"""S3 watch worker + one-shot CLI for object-storage ingestion (v1.2.2).

Mirrors the filesystem directory watcher (`process_incoming.py`), but discovers
batches from S3 (`s3_discovery`) and processes each through the shared tracking
importer (`s3_ingest.process_batch`). The filesystem path is untouched; this is a
separate module and CLI so `INGEST_STORAGE_BACKEND=filesystem` behavior is
unchanged.

Immutable-source contract: the worker only reads S3 (list/get/head). It never
renames, moves, or deletes an object. The same `_READY.json` reappearing on every
poll is expected — `process_batch` skips anything already `completed` using
PostgreSQL state.

Usage (from feed-prototype/backend, with S3_* configured and DATABASE_URL set):

    python -m app.services.process_s3_incoming                 # one pass
    python -m app.services.process_s3_incoming --watch         # poll forever
    python -m app.services.process_s3_incoming --watch --interval 10 --limit 20
"""

from __future__ import annotations

import argparse
import logging
import signal
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.db.session import create_session
from app.services.s3_discovery import DiscoveredBatch, discover_ready_batches
from app.services.s3_ingest import BatchOutcome, process_batch
from app.services.s3_storage import ObjectStore, S3IngestConfig, S3ObjectStore

logger = logging.getLogger(__name__)


SessionFactory = Callable[[], Session]
ProcessFn = Callable[[Session, ObjectStore, S3IngestConfig, DiscoveredBatch, Settings], BatchOutcome]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _default_process(
    session: Session,
    store: ObjectStore,
    config: S3IngestConfig,
    discovered: DiscoveredBatch,
    settings: Settings,
) -> BatchOutcome:
    return process_batch(session, store, config, discovered, settings)


@dataclass
class WorkerHealth:
    """Rolling operational snapshot for the worker (no secrets)."""

    last_poll_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None
    currently_processing_batch: str | None = None
    polls: int = 0
    total_completed: int = 0
    total_failed: int = 0
    total_skipped: int = 0


@dataclass
class S3ProcessResult:
    outcomes: list[BatchOutcome] = field(default_factory=list)
    discovered_count: int = 0

    def count(self, status: str) -> int:
        return sum(1 for outcome in self.outcomes if outcome.status == status)


def process_once(
    store: ObjectStore,
    config: S3IngestConfig,
    settings: Settings,
    *,
    limit: int | None = None,
    session_factory: SessionFactory = create_session,
    process_fn: ProcessFn = _default_process,
    health: WorkerHealth | None = None,
    stop_event: threading.Event | None = None,
    now_fn: Callable[[], datetime] = _utc_now,
) -> S3ProcessResult:
    """Discover ready batches and process up to `limit` of them once.

    Each batch runs on its own session (like the CLI single-import), so one bad
    batch cannot poison another. `process_fn`/`session_factory` are injectable so
    the orchestration is testable without a real DB or S3.
    """
    discovered = discover_ready_batches(store, config)
    if limit is not None and limit > 0:
        discovered = discovered[:limit]

    result = S3ProcessResult(discovered_count=len(discovered))
    for batch in discovered:
        if stop_event is not None and stop_event.is_set():
            break  # graceful: stop between batches
        if health is not None:
            health.currently_processing_batch = batch.batch_external_id

        session = session_factory()
        try:
            outcome = process_fn(session, store, config, batch, settings)
        except Exception as exc:  # noqa: BLE001 - a crash on one batch must not stop the poll
            outcome = BatchOutcome(
                batch_external_id=batch.batch_external_id,
                status="failed",
                error_code="worker_error",
                reason=f"{type(exc).__name__}: {exc}",
            )
            logger.exception("s3_watch batch crashed batch=%s", batch.batch_external_id)
        finally:
            try:
                session.close()
            except Exception:  # noqa: BLE001
                pass

        result.outcomes.append(outcome)
        _record_outcome(health, outcome, now_fn())

    if health is not None:
        health.currently_processing_batch = None
        health.last_poll_at = now_fn()
        health.polls += 1
    return result


def _record_outcome(health: WorkerHealth | None, outcome: BatchOutcome, now: datetime) -> None:
    if health is None:
        return
    if outcome.status == "completed":
        health.total_completed += 1
        health.last_success_at = now
    elif outcome.status == "failed":
        health.total_failed += 1
        health.last_error_at = now
        health.last_error_message = outcome.error_code or outcome.reason
    else:
        health.total_skipped += 1


def _log_poll(result: S3ProcessResult) -> None:
    logger.info(
        "s3_watch poll discovered=%d completed=%d failed=%d skipped=%d",
        result.discovered_count,
        result.count("completed"),
        result.count("failed"),
        result.count("skipped"),
    )
    for outcome in result.outcomes:
        if outcome.status == "failed":
            logger.warning(
                "s3_watch batch=%s status=failed code=%s",
                outcome.batch_external_id,
                outcome.error_code,
            )


def watch(
    store: ObjectStore,
    config: S3IngestConfig,
    settings: Settings,
    *,
    interval: int,
    limit: int | None = None,
    session_factory: SessionFactory = create_session,
    process_fn: ProcessFn = _default_process,
    health: WorkerHealth | None = None,
    stop_event: threading.Event | None = None,
    install_signals: bool = True,
    now_fn: Callable[[], datetime] = _utc_now,
) -> WorkerHealth:
    """Poll `process_once` every `interval` seconds until stopped.

    Graceful shutdown: SIGINT/SIGTERM (and KeyboardInterrupt) set the stop event;
    the current batch finishes, then the loop exits. `install_signals=False` and
    an injected `stop_event` let tests drive the loop deterministically.
    """
    stop_event = stop_event or threading.Event()
    health = health or WorkerHealth()
    if install_signals:
        _install_signal_handlers(stop_event)

    logger.info("s3_watch started interval=%ds limit=%s bucket=%s", interval, limit, config.bucket)
    try:
        while not stop_event.is_set():
            result = process_once(
                store,
                config,
                settings,
                limit=limit,
                session_factory=session_factory,
                process_fn=process_fn,
                health=health,
                stop_event=stop_event,
                now_fn=now_fn,
            )
            _log_poll(result)
            if stop_event.is_set():
                break
            stop_event.wait(interval)  # interruptible sleep
    except KeyboardInterrupt:
        stop_event.set()
    logger.info(
        "s3_watch stopped polls=%d completed=%d failed=%d skipped=%d",
        health.polls,
        health.total_completed,
        health.total_failed,
        health.total_skipped,
    )
    return health


def _install_signal_handlers(stop_event: threading.Event) -> None:
    def handler(signum, frame):  # noqa: ANN001
        logger.info("s3_watch received signal %s, stopping after current batch", signum)
        stop_event.set()

    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is None:
            continue
        try:
            signal.signal(sig, handler)
        except (ValueError, OSError):  # not in main thread / unsupported on platform
            pass


def _build_store_and_config(settings: Settings) -> tuple[S3ObjectStore, S3IngestConfig]:
    config = S3IngestConfig.from_settings(settings)
    store = S3ObjectStore.from_config(config)
    return store, config


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process external post batches from S3 object storage (v1.2.2)."
    )
    parser.add_argument("--watch", action="store_true", help="Poll on an interval instead of one pass.")
    parser.add_argument("--interval", type=int, default=None, help="Polling interval seconds (default: S3_WATCH_INTERVAL_SECONDS).")
    parser.add_argument("--limit", type=int, default=None, help="Max batches per poll (default: S3_WATCH_BATCH_LIMIT).")
    parser.add_argument("--database-url", default=None, help="Optional DB URL override.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    args = parse_args(argv)
    settings = get_settings()

    session_factory: SessionFactory = create_session
    if args.database_url is not None:
        from sqlmodel import create_engine

        engine = create_engine(args.database_url, pool_pre_ping=True)
        session_factory = lambda: Session(engine)  # noqa: E731

    try:
        store, config = _build_store_and_config(settings)
    except ValueError as exc:
        logger.error("s3_watch config error: %s", exc)
        return 1

    interval = args.interval if args.interval is not None else settings.s3_watch_interval_seconds
    limit = args.limit if args.limit is not None else settings.s3_watch_batch_limit

    if args.watch:
        watch(
            store,
            config,
            settings,
            interval=interval,
            limit=limit,
            session_factory=session_factory,
        )
        return 0

    health = WorkerHealth()
    result = process_once(
        store, config, settings, limit=limit, session_factory=session_factory, health=health
    )
    _log_poll(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
