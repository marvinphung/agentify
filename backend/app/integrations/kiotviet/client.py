from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.errors import IntegrationError


class KiotVietClient:
    def __init__(self, retailer: str, client_id: str, client_secret: str, access_token: str | None = None) -> None:
        self.retailer = retailer
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = access_token
        self.settings = get_settings()

    async def fetch_token(self) -> tuple[str, datetime]:
        data = {
            "scopes": "PublicApi.Access",
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(self.settings.kiotviet_token_url, data=data)
        if response.status_code >= 400:
            raise IntegrationError("Không kết nối được KiotViet token endpoint.", details={"status_code": response.status_code})
        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise IntegrationError("KiotViet không trả access_token.")
        expires_in = int(payload.get("expires_in", 3600))
        self.access_token = token
        return token, datetime.now(UTC) + timedelta(seconds=max(expires_in - 60, 60))

    async def _request(self, method: str, path: str, *, params: dict[str, Any] | None = None, json: dict[str, Any] | None = None) -> Any:
        if not self.access_token:
            await self.fetch_token()
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Retailer": self.retailer,
            "Content-Type": "application/json",
        }
        url = f"{self.settings.kiotviet_api_base_url.rstrip('/')}/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.request(method, url, headers=headers, params=params, json=json)
        if response.status_code >= 400:
            raise IntegrationError("KiotViet API trả lỗi.", details={"status_code": response.status_code, "path": path})
        return response.json()

    async def list_products(self, *, page_size: int = 20, current_item: int = 0, search_term: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"pageSize": page_size, "currentItem": current_item}
        if search_term:
            params["name"] = search_term
        return await self._request("GET", "/products", params=params)

    async def create_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/orders", json=payload)


def extract_products(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    if isinstance(data, list):
        return data
    if isinstance(payload.get("items"), list):
        return payload["items"]
    return []


def product_stock(product: dict[str, Any]) -> int:
    inventories = product.get("inventories") or []
    if inventories and isinstance(inventories[0], dict):
        return int(inventories[0].get("onHand") or inventories[0].get("onhand") or 0)
    return int(product.get("onHand") or product.get("stock") or 0)

