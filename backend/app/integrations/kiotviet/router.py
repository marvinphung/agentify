from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.integrations.kiotviet.schemas import (
    KiotVietConnectRequest,
    KiotVietConnectResponse,
    KiotVietStatusResponse,
    ProductResponse,
    CreateKiotVietCosmeticsResponse,
    SeedProductsResponse,
    SyncProductsResponse,
)
from app.integrations.kiotviet.service import connect_kiotviet, create_cosmetic_products_in_kiotviet, get_integration, list_cached_or_remote_products, seed_cosmetic_products, sync_products

router = APIRouter(prefix="/api", tags=["kiotviet"])


@router.post("/integrations/kiotviet/connect", response_model=KiotVietConnectResponse)
async def connect(payload: KiotVietConnectRequest, db: Session = Depends(get_db)) -> KiotVietConnectResponse:
    integration, sample_count = await connect_kiotviet(db, payload)
    return KiotVietConnectResponse(status=integration.status, retailer=integration.retailer, sample_product_count=sample_count)


@router.get("/integrations/kiotviet/status", response_model=KiotVietStatusResponse)
def status(db: Session = Depends(get_db)) -> KiotVietStatusResponse:
    integration = get_integration(db)
    if not integration:
        return KiotVietStatusResponse(status="disconnected")
    return KiotVietStatusResponse(status=integration.status, retailer=integration.retailer, last_sync_at=integration.last_sync_at)


@router.post("/integrations/kiotviet/sync-products", response_model=SyncProductsResponse)
async def sync(db: Session = Depends(get_db)) -> SyncProductsResponse:
    return SyncProductsResponse(synced=await sync_products(db))


@router.post("/demo/seed-cosmetics", response_model=SeedProductsResponse)
def seed_cosmetics(db: Session = Depends(get_db)) -> SeedProductsResponse:
    return SeedProductsResponse(seeded=seed_cosmetic_products(db))


@router.post("/demo/create-cosmetics-in-kiotviet", response_model=CreateKiotVietCosmeticsResponse)
async def create_cosmetics_in_kiotviet(db: Session = Depends(get_db)) -> CreateKiotVietCosmeticsResponse:
    created, existing, synced = await create_cosmetic_products_in_kiotviet(db)
    return CreateKiotVietCosmeticsResponse(created=created, existing=existing, synced=synced)


@router.get("/kiotviet/products", response_model=list[ProductResponse])
async def products(search: str | None = None, db: Session = Depends(get_db)) -> list[ProductResponse]:
    rows = await list_cached_or_remote_products(db, search)
    return [ProductResponse.model_validate(row, from_attributes=True) for row in rows]
