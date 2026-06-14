from dataclasses import asdict

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.api.deps import get_session
from app.core.config import get_settings
from app.models.account import Account
from app.models.import_batch import ImportBatch
from app.models.post import Post
from app.schemas.external_import import (
    ExternalImportPayload,
    ImportBatchDetailResponse,
    ImportBatchListResponse,
    ImportBatchPost,
    ImportBatchSummary,
    ImportSummaryResponse,
)
from app.services.import_external_posts import (
    ImportErrorWithMessage,
    import_payload,
    record_failed_batch,
)


router = APIRouter(prefix="/api/imports", tags=["imports"])


def verify_import_token(x_import_token: str | None = Header(default=None)) -> None:
    """Minimal optional protection for the write endpoint (v0.3.0).

    When `import_api_token` is unset (default), no check is performed and the
    endpoint follows the local CLI trust model. When set, the request must send
    a matching `X-Import-Token` header. This is not real auth (auth is v0.6.x).
    """
    token = get_settings().import_api_token
    if token is None:
        return
    if x_import_token != token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing import token.",
        )


@router.post(
    "",
    response_model=ImportSummaryResponse,
    dependencies=[Depends(verify_import_token)],
)
def create_import(
    payload: ExternalImportPayload,
    dry_run: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> ImportSummaryResponse:
    """Import the same package JSON the CLI accepts, over HTTP.

    Reuses `import_payload` and mirrors `run_import`'s transaction contract:
    dry_run rolls back, success commits, any error rolls back. Body validation
    is handled by FastAPI against `ExternalImportPayload` (422 on failure);
    payload-level semantic errors map to 400; anything else surfaces as 500.

    On a real (non-dry-run) failure the batch is recorded as failed, mirroring
    the CLI. dry_run records nothing (no DB writes contract).
    """
    try:
        summary = import_payload(session, payload, dry_run=dry_run)
        if dry_run:
            session.rollback()
        else:
            session.commit()
    except ImportErrorWithMessage as exc:
        session.rollback()
        if not dry_run:
            record_failed_batch(session, payload.batch, str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        session.rollback()
        if not dry_run:
            record_failed_batch(session, payload.batch, f"{type(exc).__name__}: {exc}")
        raise

    return ImportSummaryResponse(
        batch_external_id=payload.batch.external_id,
        dry_run=dry_run,
        **asdict(summary),
    )


def _live_post_counts(session: Session) -> dict[str, int]:
    """Count posts currently attributed to each batch external id."""
    rows = session.exec(
        select(Post.import_batch_external_id, func.count())
        .where(col(Post.import_batch_external_id).is_not(None))
        .group_by(Post.import_batch_external_id)
    ).all()
    return {batch_external_id: count for batch_external_id, count in rows}


@router.get("", response_model=ImportBatchListResponse)
def list_imports(
    session: Session = Depends(get_session),
) -> ImportBatchListResponse:
    """List import batches, most recently imported first (v0.3.1).

    Current scale returns all batches without pagination. Each item carries the
    latest event's count snapshot plus the live post count for the batch.
    """
    batches = session.exec(
        select(ImportBatch).order_by(col(ImportBatch.last_imported_at).desc())
    ).all()
    post_counts = _live_post_counts(session)

    items = [
        ImportBatchSummary(
            **batch.model_dump(),
            post_count=post_counts.get(batch.external_id, 0),
        )
        for batch in batches
    ]
    return ImportBatchListResponse(items=items)


@router.get("/{batch_external_id}", response_model=ImportBatchDetailResponse)
def get_import(
    batch_external_id: str,
    session: Session = Depends(get_session),
) -> ImportBatchDetailResponse:
    """Batch detail: the batch row plus the posts currently attributed to it."""
    batch = session.exec(
        select(ImportBatch).where(ImportBatch.external_id == batch_external_id)
    ).first()
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import batch not found: {batch_external_id}",
        )

    rows = session.exec(
        select(Post, Account)
        .join(Account, col(Post.account_id) == col(Account.id))
        .where(Post.import_batch_external_id == batch_external_id)
        .order_by(col(Post.created_at).desc(), col(Post.id))
    ).all()

    posts = [
        ImportBatchPost(
            id=post.id,
            external_id=post.external_id,
            title=post.title,
            account_id=post.account_id,
            account_handle=account.handle,
            account_display_name=account.display_name,
            created_at=post.created_at,
            imported_at=post.imported_at,
        )
        for post, account in rows
    ]

    summary = ImportBatchSummary(
        **batch.model_dump(),
        post_count=len(posts),
    )
    return ImportBatchDetailResponse(batch=summary, posts=posts)
