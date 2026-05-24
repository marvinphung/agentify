from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import IntegrationError
from app.models import ZaloIntegration
from app.security import encrypt_secret, decrypt_secret
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


def get_integration(db: Session, workspace_id: int = DEFAULT_WORKSPACE_ID) -> ZaloIntegration | None:
    return db.scalar(select(ZaloIntegration).where(ZaloIntegration.workspace_id == workspace_id))


def _ensure_integration(db: Session, workspace_id: int = DEFAULT_WORKSPACE_ID) -> ZaloIntegration:
    ensure_default_workspace(db)
    integration = get_integration(db, workspace_id)
    if integration is not None:
        return integration
    integration = ZaloIntegration(workspace_id=workspace_id, status="disconnected")
    db.add(integration)
    return integration


def _state_for_workspace() -> str:
    return f"workspace-{DEFAULT_WORKSPACE_ID}"


def get_status(db: Session, workspace_id: int = DEFAULT_WORKSPACE_ID) -> dict[str, Any]:
    integration = get_integration(db, workspace_id=workspace_id)
    if not integration or integration.status != "connected":
        return {"status": "disconnected"}

    return {
        "status": integration.status,
        "app_id": integration.oa_id,
        "oa_id": integration.oa_id,
        "token_expires_at": integration.token_expires_at,
    }


def build_authorize_url(*, workspace_id: int = DEFAULT_WORKSPACE_ID) -> dict[str, str]:
    settings = get_settings()
    if not settings.zalo_app_id:
        raise IntegrationError("Chưa cấu hình Zalo App ID trong backend.")
    query = {
        "app_id": settings.zalo_app_id,
        "redirect_uri": settings.effective_zalo_redirect_uri,
        "state": f"{_state_for_workspace()}:{workspace_id}",
    }
    return {
        "authorize_url": f"{settings.zalo_authorize_url}?{urlencode(query)}",
        "state": query["state"],
    }


async def exchange_code_for_access_token(db: Session, code: str, *, workspace_id: int = DEFAULT_WORKSPACE_ID) -> ZaloIntegration:
    settings = get_settings()
    if not settings.zalo_app_id or not settings.zalo_app_secret:
        raise IntegrationError("Chưa cấu hình Zalo App ID/Secret trong backend.")
    payload = {
        "app_id": settings.zalo_app_id,
        "app_secret": settings.zalo_app_secret,
        "code": code,
        "redirect_uri": settings.effective_zalo_redirect_uri,
    }
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.post(settings.zalo_token_url, data=payload)
    if response.status_code >= 400:
        raise IntegrationError(
            "Không đổi được mã auth của Zalo thành token.",
            details={"status_code": response.status_code},
        )
    try:
        payload_data = response.json()
    except ValueError as exc:
        raise IntegrationError("Zalo callback trả về dữ liệu token không đúng định dạng JSON.", details={"status_code": response.status_code}) from exc
    if isinstance(payload_data, dict) and isinstance(payload_data.get("data"), dict):
        payload_data = payload_data["data"]
    if not isinstance(payload_data, dict) or "access_token" not in payload_data:
        raise IntegrationError("Zalo callback không trả access_token.")

    token = str(payload_data["access_token"])
    expires_in = int(payload_data.get("expires_in", payload_data.get("expire_in", 3600)))
    token_expires_at = datetime.now(UTC) + timedelta(seconds=max(expires_in - 60, 60))
    oa_id = str(payload_data.get("oa_id") or payload_data.get("oaId") or "")

    ensure_default_workspace(db)
    integration = _ensure_integration(db, workspace_id=workspace_id)
    integration.oa_id = oa_id or "zalo-oa"
    integration.access_token = encrypt_secret(token)
    integration.status = "connected"
    integration.token_expires_at = token_expires_at
    integration.last_connected_at = datetime.now(UTC)
    return integration


def save_manual_access_token(db: Session, access_token: str, *, workspace_id: int = DEFAULT_WORKSPACE_ID, oa_id: str | None = None) -> ZaloIntegration:
    integration = _ensure_integration(db, workspace_id=workspace_id)
    integration.oa_id = oa_id
    integration.access_token = encrypt_secret(access_token)
    integration.status = "connected"
    integration.token_expires_at = datetime.now(UTC) + timedelta(days=365)
    integration.last_connected_at = datetime.now(UTC)
    return integration


async def get_access_token(db: Session, workspace_id: int = DEFAULT_WORKSPACE_ID) -> str | None:
    integration = get_integration(db, workspace_id=workspace_id)
    if not integration:
        return None
    if integration.access_token is None or integration.status != "connected":
        return None
    if integration.token_expires_at and integration.token_expires_at <= datetime.now(UTC):
        return None
    return decrypt_secret(integration.access_token)


async def send_message(
    db: Session,
    *,
    recipient_user_id: str,
    message: str,
    workspace_id: int = DEFAULT_WORKSPACE_ID,
) -> tuple[bool, str]:
    access_token = await get_access_token(db, workspace_id=workspace_id)
    if not access_token:
        return False, "Chưa có kết nối Zalo OA hợp lệ."

    integration = get_integration(db, workspace_id=workspace_id)
    settings = get_settings()
    payload = {
        "recipient": {"user_id": recipient_user_id},
        "message": {"text": message},
    }
    headers = {
        "Content-Type": "application/json",
        "access_token": access_token,
    }
    if integration and integration.oa_id:
        payload["oa_id"] = integration.oa_id

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(settings.zalo_send_message_url, headers=headers, json=payload)
    except Exception as exc:
        return False, f"Không gửi tin nhắn Zalo thất bại: {exc.__class__.__name__}"

    if response.status_code >= 400:
        details = {"status_code": response.status_code}
        try:
            details["response"] = response.json()
        except Exception:
            details["response"] = response.text
        return False, f"Gửi tin nhắn Zalo thất bại: {response.status_code}"

    return True, "Đã gửi tin nhắn Zalo OA thành công."
