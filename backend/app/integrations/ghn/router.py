from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_workspace
from app.database import get_db
from app.integrations.ghn.client import GHNClientError
from app.integrations.ghn.schemas import GHNConnectRequest, GHNConnectResponse
from app.integrations.ghn.service import authorize_ghn, preview_ghn
from app.models import Workspace

router = APIRouter(prefix="/api/integrations/ghn", tags=["ghn"])


@router.post("/preview", response_model=GHNConnectResponse)
def preview(payload: GHNConnectRequest, _: Workspace = Depends(get_current_workspace)) -> GHNConnectResponse:
    try:
        return preview_ghn(payload)
    except GHNClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/authorize", response_model=GHNConnectResponse)
def authorize(
    payload: GHNConnectRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
) -> GHNConnectResponse:
    try:
        return authorize_ghn(db, workspace.id, payload)
    except GHNClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
