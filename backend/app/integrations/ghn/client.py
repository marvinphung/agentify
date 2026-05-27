from __future__ import annotations

import httpx

from app.config import Settings
from app.integrations.ghn.schemas import GHNCreateOrderRequest, GHNShipmentResult, GHNTrackingResult


class GHNClientError(RuntimeError):
    pass


class GHNClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.ghn_base_url.rstrip("/")

    def _headers(self, *, include_shop: bool = False) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Token": self.settings.ghn_token,
        }
        if include_shop:
            headers["ShopId"] = str(self.settings.ghn_shop_id)
        return headers

    def create_order(self, payload: GHNCreateOrderRequest) -> GHNShipmentResult:
        response = httpx.post(
            f"{self.base_url}/v2/shipping-order/create",
            headers=self._headers(include_shop=True),
            json=payload.model_dump(exclude_none=True),
            timeout=self.settings.request_timeout_seconds,
        )
        body = self._parse_response(response)
        data = body.get("data") or {}
        order_code = data.get("order_code")
        if not order_code:
            raise GHNClientError("GHN không trả về mã vận đơn.")
        return GHNShipmentResult(
            order_code=str(order_code),
            status=str(data.get("status") or "created"),
            total_fee=int(data.get("total_fee") or data.get("fee") or 0),
            expected_delivery_time=data.get("expected_delivery_time"),
            raw=body,
        )

    def order_detail(self, order_code: str) -> GHNTrackingResult:
        response = httpx.post(
            f"{self.base_url}/v2/shipping-order/detail",
            headers=self._headers(),
            json={"order_code": order_code},
            timeout=self.settings.request_timeout_seconds,
        )
        body = self._parse_response(response)
        data = body.get("data") or {}
        return GHNTrackingResult(
            order_code=str(data.get("order_code") or order_code),
            status=str(data.get("status") or "unknown"),
            status_name=data.get("status_name"),
            expected_delivery_time=data.get("leadtime") or data.get("expected_delivery_time"),
            raw=body,
        )

    @staticmethod
    def _parse_response(response: httpx.Response) -> dict:
        try:
            body = response.json()
        except ValueError as exc:
            raise GHNClientError(f"GHN trả về response không phải JSON: HTTP {response.status_code}") from exc
        if response.status_code >= 400 or body.get("code") not in (200, "200", None):
            message = body.get("message") or f"HTTP {response.status_code}"
            raise GHNClientError(f"GHN lỗi: {message}")
        return body
