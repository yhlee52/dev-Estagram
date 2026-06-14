from dataclasses import asdict

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session
from app.core.config import get_settings
from app.schemas.external_import import ExternalImportPayload, ImportSummaryResponse
from app.services.import_external_posts import ImportErrorWithMessage, import_payload


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
    """
    try:
        summary = import_payload(session, payload, dry_run=dry_run)
        if dry_run:
            session.rollback()
        else:
            session.commit()
    except ImportErrorWithMessage as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception:
        session.rollback()
        raise

    return ImportSummaryResponse(
        batch_external_id=payload.batch.external_id,
        dry_run=dry_run,
        **asdict(summary),
    )
