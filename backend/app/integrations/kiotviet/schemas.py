from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class KiotVietConnectRequest(BaseModel):
    retailer: str = Field(min_length=2)
    client_id: str = Field(min_length=8)
    client_secret: str = Field(min_length=8)


class KiotVietConnectResponse(BaseModel):
    status: str
    retailer: str
    sample_product_count: int


class KiotVietConnectFromEnvResponse(BaseModel):
    status: str
    retailer: str
    sample_product_count: int


class KiotVietPreviewResponse(BaseModel):
    status: str
    retailer: str
    detected_shop_name: str
    sample_product_count: int


class KiotVietAuthorizeResponse(BaseModel):
    status: str
    retailer: str
    sample_product_count: int
    synced_product_count: int


class KiotVietStatusResponse(BaseModel):
    status: str
    retailer: str | None = None
    last_sync_at: datetime | None = None


class ProductResponse(BaseModel):
    id: int
    kiotviet_product_id: int
    code: str | None
    name: str
    base_price: Decimal
    stock: int


class SyncProductsResponse(BaseModel):
    synced: int


class SeedProductsResponse(BaseModel):
    seeded: int


class CreateKiotVietCosmeticsResponse(BaseModel):
    created: int
    existing: int
    synced: int
