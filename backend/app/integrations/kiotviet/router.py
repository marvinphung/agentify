from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_workspace, get_optional_current_user
from app.database import get_db
from app.integrations.kiotviet.schemas import (
    KiotVietAuthorizeResponse,
    KiotVietConnectRequest,
    KiotVietConnectResponse,
    KiotVietConnectFromEnvResponse,
    KiotVietPreviewResponse,
    KiotVietStatusResponse,
    ProductResponse,
    CreateKiotVietCosmeticsResponse,
    SeedProductsResponse,
    SyncProductsResponse,
)
from app.auth.service import primary_workspace_for_user
from app.integrations.kiotviet.service import connect_kiotviet, connect_kiotviet_from_env, create_cosmetic_products_in_kiotviet, get_integration, list_cached_or_remote_products, preview_kiotviet, seed_cosmetic_products, sync_products
from app.models import User, Workspace
from app.shared.workspace import DEFAULT_WORKSPACE_ID

router = APIRouter(prefix="/api", tags=["kiotviet"])


@router.post("/integrations/kiotviet/connect", response_model=KiotVietConnectResponse)
async def connect(payload: KiotVietConnectRequest, db: Session = Depends(get_db)) -> KiotVietConnectResponse:
    integration, sample_count = await connect_kiotviet(db, payload)
    return KiotVietConnectResponse(status=integration.status, retailer=integration.retailer, sample_product_count=sample_count)


@router.post("/integrations/kiotviet/connect/env", response_model=KiotVietConnectFromEnvResponse)
async def connect_from_env(db: Session = Depends(get_db)) -> KiotVietConnectFromEnvResponse:
    integration, sample_count = await connect_kiotviet_from_env(db)
    return KiotVietConnectFromEnvResponse(status=integration.status, retailer=integration.retailer, sample_product_count=sample_count)


@router.get("/integrations/kiotviet/status", response_model=KiotVietStatusResponse)
def status(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> KiotVietStatusResponse:
    workspace_id = DEFAULT_WORKSPACE_ID
    if user:
        workspace = primary_workspace_for_user(db, user)
        if workspace:
            workspace_id = workspace.id
    integration = get_integration(db, workspace_id)
    if not integration:
        return KiotVietStatusResponse(status="disconnected")
    return KiotVietStatusResponse(status=integration.status, retailer=integration.retailer, last_sync_at=integration.last_sync_at)


@router.post("/integrations/kiotviet/preview", response_model=KiotVietPreviewResponse)
async def preview(payload: KiotVietConnectRequest, _: Workspace = Depends(get_current_workspace)) -> KiotVietPreviewResponse:
    sample_count = await preview_kiotviet(payload)
    return KiotVietPreviewResponse(
        status="valid",
        retailer=payload.retailer,
        detected_shop_name=payload.retailer,
        sample_product_count=sample_count,
    )


@router.post("/integrations/kiotviet/authorize", response_model=KiotVietAuthorizeResponse)
async def authorize(
    payload: KiotVietConnectRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
) -> KiotVietAuthorizeResponse:
    integration, sample_count = await connect_kiotviet(db, payload, workspace_id=workspace.id)
    synced_count = await sync_products(db, workspace_id=workspace.id)
    return KiotVietAuthorizeResponse(
        status=integration.status,
        retailer=integration.retailer,
        sample_product_count=sample_count,
        synced_product_count=synced_count,
    )


@router.post("/integrations/kiotviet/sync-products", response_model=SyncProductsResponse)
async def sync(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> SyncProductsResponse:
    workspace_id = DEFAULT_WORKSPACE_ID
    if user:
        workspace = primary_workspace_for_user(db, user)
        if workspace:
            workspace_id = workspace.id
    return SyncProductsResponse(synced=await sync_products(db, workspace_id=workspace_id))


@router.post("/demo/seed-cosmetics", response_model=SeedProductsResponse)
def seed_cosmetics(db: Session = Depends(get_db)) -> SeedProductsResponse:
    return SeedProductsResponse(seeded=seed_cosmetic_products(db))


@router.post("/demo/create-cosmetics-in-kiotviet", response_model=CreateKiotVietCosmeticsResponse)
async def create_cosmetics_in_kiotviet(db: Session = Depends(get_db)) -> CreateKiotVietCosmeticsResponse:
    created, existing, synced = await create_cosmetic_products_in_kiotviet(db)
    return CreateKiotVietCosmeticsResponse(created=created, existing=existing, synced=synced)


@router.get("/kiotviet/products", response_model=list[ProductResponse])
async def products(
    search: str | None = None,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> list[ProductResponse]:
    workspace_id = DEFAULT_WORKSPACE_ID
    if user:
        workspace = primary_workspace_for_user(db, user)
        if workspace:
            workspace_id = workspace.id
    rows = await list_cached_or_remote_products(db, search, workspace_id=workspace_id)
    return [ProductResponse.model_validate(row, from_attributes=True) for row in rows]
