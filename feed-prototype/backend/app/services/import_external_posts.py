import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import ValidationError
from sqlmodel import Session, col, create_engine, select

from app.db.session import create_session
from app.models.account import Account
from app.models.asset import PostAsset
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.models.user import User
from app.schemas.external_import import (
    ExternalImportAccount,
    ExternalImportBatch,
    ExternalImportPayload,
    ExternalImportPost,
)


@dataclass
class ImportSummary:
    accounts_created: int = 0
    accounts_updated: int = 0
    users_created: int = 0
    users_updated: int = 0
    posts_created: int = 0
    posts_updated: int = 0
    posts_skipped: int = 0
    asset_replace_target_posts: int = 0
    assets_deleted: int = 0
    assets_created: int = 0
    errors: int = 0


class ImportErrorWithMessage(Exception):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def load_payload(input_path: Path) -> ExternalImportPayload:
    if not input_path.exists():
        raise ImportErrorWithMessage(f"Input file not found: {input_path}")
    if not input_path.is_file():
        raise ImportErrorWithMessage(f"Input path is not a file: {input_path}")

    try:
        raw_payload: Any = json.loads(input_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ImportErrorWithMessage(
            f"Invalid JSON in {input_path}: line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc

    try:
        return ExternalImportPayload.model_validate(raw_payload)
    except ValidationError as exc:
        raise ImportErrorWithMessage(f"Import payload validation failed:\n{exc}") from exc


def ensure_unique_payload_ids(payload: ExternalImportPayload) -> None:
    duplicate_messages = [
        find_duplicate_message(
            "account.external_id",
            [account.external_id for account in payload.accounts],
        ),
        find_duplicate_message(
            "post.external_id",
            [post.external_id for post in payload.posts],
        ),
        find_duplicate_message(
            "asset.external_id",
            [
                asset.external_id
                for post in payload.posts
                for asset in post.assets
                if asset.external_id is not None
            ],
        ),
    ]
    duplicate_messages = [message for message in duplicate_messages if message is not None]
    if duplicate_messages:
        raise ImportErrorWithMessage("\n".join(duplicate_messages))


def find_duplicate_message(name: str, values: list[str]) -> str | None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)

    if not duplicates:
        return None

    return f"Duplicate {name} values in payload: {', '.join(sorted(duplicates))}"


def slugify_external_id(external_id: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", external_id.strip().lower())
    slug = slug.strip(".-_")
    return slug or "external"


def generated_user_id(account_external_id: str) -> str:
    return f"import-user-{slugify_external_id(account_external_id)}"


def generated_account_id(account_external_id: str) -> str:
    return f"import-account-{slugify_external_id(account_external_id)}"


def generated_user_handle(account_external_id: str) -> str:
    # User has no external_id in MVP10-2. Each imported Account gets one paired
    # generic import User, identified by deterministic id/handle rules.
    return f"import.{slugify_external_id(account_external_id)}"


def get_account_by_external_id(session: Session, external_id: str) -> Account | None:
    return session.exec(select(Account).where(Account.external_id == external_id)).first()


def get_post_by_external_id(session: Session, external_id: str) -> Post | None:
    return session.exec(select(Post).where(Post.external_id == external_id)).first()


def get_post_assets(session: Session, post_id: str) -> list[PostAsset]:
    return list(
        session.exec(
            select(PostAsset)
            .where(PostAsset.post_id == post_id)
            .order_by(
                col(PostAsset.sort_order).is_(None),
                PostAsset.sort_order,
                PostAsset.created_at,
                PostAsset.id,
            )
        ).all()
    )


def ensure_import_user(
    session: Session,
    account_input: ExternalImportAccount,
    *,
    dry_run: bool,
    summary: ImportSummary,
) -> str:
    user_id = generated_user_id(account_input.external_id)
    existing_user = session.get(User, user_id)
    if existing_user is None:
        summary.users_created += 1
        if not dry_run:
            session.add(
                User(
                    id=user_id,
                    handle=generated_user_handle(account_input.external_id),
                    display_name=account_input.display_name,
                    avatar_url=account_input.avatar_url,
                    bio=account_input.bio,
                )
            )
        return user_id

    summary.users_updated += 1
    if not dry_run:
        existing_user.display_name = account_input.display_name
        existing_user.avatar_url = account_input.avatar_url
        existing_user.bio = account_input.bio
        existing_user.updated_at = utc_now()
        session.add(existing_user)

    return user_id


def upsert_account(
    session: Session,
    account_input: ExternalImportAccount,
    *,
    dry_run: bool,
    summary: ImportSummary,
) -> Account | None:
    user_id = ensure_import_user(session, account_input, dry_run=dry_run, summary=summary)
    existing_account = get_account_by_external_id(session, account_input.external_id)
    if existing_account is None:
        summary.accounts_created += 1
        if dry_run:
            return Account(
                id=generated_account_id(account_input.external_id),
                external_id=account_input.external_id,
                user_id=user_id,
                handle=account_input.handle,
                display_name=account_input.display_name,
                bio=account_input.bio,
                avatar_url=account_input.avatar_url,
                kind="bot",
            )

        account = Account(
            id=generated_account_id(account_input.external_id),
            external_id=account_input.external_id,
            user_id=user_id,
            handle=account_input.handle,
            display_name=account_input.display_name,
            bio=account_input.bio,
            avatar_url=account_input.avatar_url,
            kind="bot",
        )
        session.add(account)
        return account

    summary.accounts_updated += 1
    if not dry_run:
        existing_account.handle = account_input.handle
        existing_account.display_name = account_input.display_name
        existing_account.bio = account_input.bio
        existing_account.avatar_url = account_input.avatar_url
        existing_account.updated_at = utc_now()
        session.add(existing_account)

    return existing_account


def resolve_account_for_post(
    session: Session,
    account_external_id: str,
    accounts_by_external_id: dict[str, Account],
) -> Account:
    account = accounts_by_external_id.get(account_external_id)
    if account is not None:
        return account

    account = get_account_by_external_id(session, account_external_id)
    if account is None:
        raise ImportErrorWithMessage(
            "Post references an unknown account_external_id: "
            f"{account_external_id}. Include the account in the payload or import it first."
        )

    accounts_by_external_id[account_external_id] = account
    return account


def upsert_post(
    session: Session,
    post_input: ExternalImportPost,
    *,
    account: Account,
    batch_external_id: str,
    dry_run: bool,
    summary: ImportSummary,
) -> Post | None:
    existing_post = get_post_by_external_id(session, post_input.external_id)
    now = utc_now()

    if existing_post is None:
        summary.posts_created += 1
        if dry_run:
            return None

        post = Post(
            id=f"post-{uuid4()}",
            external_id=post_input.external_id,
            account_id=account.id,
            title=post_input.title,
            text=post_input.text,
            tags=post_input.tags,
            metadata_json=post_input.metadata_json,
            created_at=post_input.created_at or now,
            updated_at=now,
            imported_at=now,
            import_batch_external_id=batch_external_id,
        )
        session.add(post)
        return post

    summary.posts_updated += 1
    if not dry_run:
        existing_post.account_id = account.id
        existing_post.title = post_input.title
        existing_post.text = post_input.text
        existing_post.tags = post_input.tags
        existing_post.metadata_json = post_input.metadata_json
        if post_input.created_at is not None:
            existing_post.created_at = post_input.created_at
        existing_post.updated_at = now
        existing_post.imported_at = now
        existing_post.import_batch_external_id = batch_external_id
        session.add(existing_post)

    return existing_post


def replace_assets_for_post(
    session: Session,
    post: Post,
    post_input: ExternalImportPost,
    *,
    dry_run: bool,
    summary: ImportSummary,
) -> None:
    if "assets" not in post_input.model_fields_set:
        return

    existing_assets = get_post_assets(session, post.id)
    summary.asset_replace_target_posts += 1
    summary.assets_deleted += len(existing_assets)
    summary.assets_created += len(post_input.assets)

    if dry_run:
        return

    for asset in existing_assets:
        session.delete(asset)

    session.flush()

    for asset_input in post_input.assets:
        session.add(
            PostAsset(
                id=f"asset-{uuid4()}",
                external_id=asset_input.external_id,
                post_id=post.id,
                type=asset_input.type,
                title=asset_input.title,
                description=asset_input.description,
                url=asset_input.url,
                src=asset_input.url,
                sort_order=asset_input.sort_order,
            )
        )


def analyze_assets_for_dry_run(
    session: Session,
    post_input: ExternalImportPost,
    summary: ImportSummary,
) -> None:
    if "assets" not in post_input.model_fields_set:
        return

    existing_post = get_post_by_external_id(session, post_input.external_id)
    existing_count = len(get_post_assets(session, existing_post.id)) if existing_post else 0
    summary.asset_replace_target_posts += 1
    summary.assets_deleted += existing_count
    summary.assets_created += len(post_input.assets)


def record_batch(
    session: Session,
    batch: ExternalImportBatch,
    summary: ImportSummary,
    *,
    status: str,
    error_message: str | None = None,
) -> None:
    """Upsert the import_batch row for this batch event (v0.3.1).

    Keyed on `batch.external_id`: re-importing the same batch updates the row in
    place (preserving `first_imported_at`, incrementing `import_count`). The
    count columns are a snapshot of the latest attempt — real counts on success,
    zeros on failure (a failed import applies nothing). Caller controls the
    transaction; this only stages the row (no commit).
    """
    now = utc_now()
    existing = session.exec(
        select(ImportBatch).where(ImportBatch.external_id == batch.external_id)
    ).first()

    if existing is None:
        session.add(
            ImportBatch(
                id=f"import-batch-{uuid4()}",
                external_id=batch.external_id,
                source=batch.source,
                batch_created_at=batch.created_at,
                status=status,
                error_message=error_message,
                first_imported_at=now,
                last_imported_at=now,
                import_count=1,
                accounts_created=summary.accounts_created,
                accounts_updated=summary.accounts_updated,
                users_created=summary.users_created,
                users_updated=summary.users_updated,
                posts_created=summary.posts_created,
                posts_updated=summary.posts_updated,
                posts_skipped=summary.posts_skipped,
                asset_replace_target_posts=summary.asset_replace_target_posts,
                assets_deleted=summary.assets_deleted,
                assets_created=summary.assets_created,
                errors=summary.errors,
            )
        )
        return

    existing.source = batch.source
    existing.batch_created_at = batch.created_at
    existing.status = status
    existing.error_message = error_message
    existing.last_imported_at = now
    existing.import_count += 1
    existing.accounts_created = summary.accounts_created
    existing.accounts_updated = summary.accounts_updated
    existing.users_created = summary.users_created
    existing.users_updated = summary.users_updated
    existing.posts_created = summary.posts_created
    existing.posts_updated = summary.posts_updated
    existing.posts_skipped = summary.posts_skipped
    existing.asset_replace_target_posts = summary.asset_replace_target_posts
    existing.assets_deleted = summary.assets_deleted
    existing.assets_created = summary.assets_created
    existing.errors = summary.errors
    session.add(existing)


def record_failed_batch(
    session: Session,
    batch: ExternalImportBatch,
    message: str,
) -> None:
    """Record a failed import in its own transaction, best-effort.

    The caller has already rolled back the failed import transaction, so the
    session is clean. We never let batch bookkeeping mask the original import
    error: if recording itself fails, we just roll back and move on.
    """
    try:
        record_batch(session, batch, ImportSummary(), status="failed", error_message=message)
        session.commit()
    except Exception:
        session.rollback()


def import_payload(
    session: Session,
    payload: ExternalImportPayload,
    *,
    dry_run: bool,
) -> ImportSummary:
    ensure_unique_payload_ids(payload)
    summary = ImportSummary()
    accounts_by_external_id: dict[str, Account] = {}

    for account_input in payload.accounts:
        account = upsert_account(session, account_input, dry_run=dry_run, summary=summary)
        if account is not None:
            accounts_by_external_id[account.external_id or account_input.external_id] = account

    if not dry_run:
        session.flush()
        for account_input in payload.accounts:
            account = get_account_by_external_id(session, account_input.external_id)
            if account is not None:
                accounts_by_external_id[account_input.external_id] = account

    for post_input in payload.posts:
        account = resolve_account_for_post(
            session,
            post_input.account_external_id,
            accounts_by_external_id,
        )

        if dry_run:
            existing_post = get_post_by_external_id(session, post_input.external_id)
            if existing_post is None:
                summary.posts_created += 1
            else:
                summary.posts_updated += 1
            analyze_assets_for_dry_run(session, post_input, summary)
            continue

        post = upsert_post(
            session,
            post_input,
            account=account,
            batch_external_id=payload.batch.external_id,
            dry_run=dry_run,
            summary=summary,
        )
        if post is None:
            summary.posts_skipped += 1
            continue
        session.flush()
        replace_assets_for_post(session, post, post_input, dry_run=dry_run, summary=summary)

    # Record the successful batch event atomically with the imported rows
    # (caller commits). dry_run writes nothing, including no batch row, so the
    # dry-run "no DB writes" contract holds for both CLI and HTTP.
    if not dry_run:
        record_batch(session, payload.batch, summary, status="success")

    return summary


def print_summary(
    *,
    payload: ExternalImportPayload,
    input_path: Path,
    summary: ImportSummary,
    dry_run: bool,
) -> None:
    if dry_run:
        print("External post import dry-run summary")
        print(f"Input: {input_path}")
        print(f"Batch: {payload.batch.external_id}")
        print("Accounts:")
        print(f"- create: {summary.accounts_created}")
        print(f"- update: {summary.accounts_updated}")
        print("Users:")
        print(f"- create: {summary.users_created}")
        print(f"- update: {summary.users_updated}")
        print("Posts:")
        print(f"- create: {summary.posts_created}")
        print(f"- update: {summary.posts_updated}")
        print(f"- skip: {summary.posts_skipped}")
        print("Assets:")
        print(f"- replace target posts: {summary.asset_replace_target_posts}")
        print(f"- delete existing: {summary.assets_deleted}")
        print(f"- create: {summary.assets_created}")
        print("Errors:")
        print(f"- {summary.errors}")
        return

    print("External post import completed")
    print(f"Input: {input_path}")
    print(f"Batch: {payload.batch.external_id}")
    print(f"Users created: {summary.users_created}")
    print(f"Users updated: {summary.users_updated}")
    print(f"Accounts created: {summary.accounts_created}")
    print(f"Accounts updated: {summary.accounts_updated}")
    print(f"Posts created: {summary.posts_created}")
    print(f"Posts updated: {summary.posts_updated}")
    print(f"Posts skipped: {summary.posts_skipped}")
    print(f"Asset replace target posts: {summary.asset_replace_target_posts}")
    print(f"Assets deleted: {summary.assets_deleted}")
    print(f"Assets created: {summary.assets_created}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import external post JSON into the feed DB.")
    parser.add_argument("--input", required=True, help="Path to the external post JSON file.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and summarize without DB writes.")
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional database URL override. Defaults to backend .env or DATABASE_URL.",
    )
    return parser.parse_args(argv)


def run_import(
    *,
    input_path: Path,
    dry_run: bool,
    database_url: str | None = None,
    print_result: bool = True,
) -> ImportSummary:
    payload = load_payload(input_path)
    engine = create_engine(database_url, pool_pre_ping=True) if database_url is not None else None
    session = Session(engine) if engine is not None else create_session()
    try:
        summary = import_payload(session, payload, dry_run=dry_run)
        if dry_run:
            session.rollback()
        else:
            session.commit()
    except Exception as exc:
        session.rollback()
        # Real imports record the failed batch (payload parsed here, so the batch
        # id is trusted). dry_run records nothing.
        if not dry_run:
            record_failed_batch(session, payload.batch, f"{type(exc).__name__}: {exc}")
        raise
    finally:
        session.close()
        if engine is not None:
            engine.dispose()

    # Callers that drive many imports (e.g. the directory-batch processor in
    # v0.3.2) print their own concise per-package summary and suppress this.
    if print_result:
        print_summary(payload=payload, input_path=input_path, summary=summary, dry_run=dry_run)
    return summary


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        run_import(
            input_path=Path(args.input),
            dry_run=args.dry_run,
            database_url=args.database_url,
        )
    except ImportErrorWithMessage as exc:
        print(f"External post import failed\n{exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"External post import failed\n{type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
