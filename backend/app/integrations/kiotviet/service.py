from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.kiotviet.client import KiotVietClient, extract_products, product_stock
from app.integrations.kiotviet.schemas import KiotVietConnectRequest
from app.models import KiotVietIntegration, ProductCache
from app.security import decrypt_secret, encrypt_secret
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


def get_integration(db: Session, workspace_id: int = DEFAULT_WORKSPACE_ID) -> KiotVietIntegration | None:
    return db.scalar(select(KiotVietIntegration).where(KiotVietIntegration.workspace_id == workspace_id))


async def connect_kiotviet(db: Session, data: KiotVietConnectRequest) -> tuple[KiotVietIntegration, int]:
    ensure_default_workspace(db)
    client = KiotVietClient(data.retailer, data.client_id, data.client_secret)
    token, expires_at = await client.fetch_token()
    sample_payload = await client.list_products(page_size=3)
    sample_count = len(extract_products(sample_payload))

    integration = get_integration(db)
    if integration is None:
        integration = KiotVietIntegration(workspace_id=DEFAULT_WORKSPACE_ID, retailer=data.retailer, client_id=data.client_id, encrypted_client_secret="")
        db.add(integration)
    integration.retailer = data.retailer
    integration.client_id = data.client_id
    integration.encrypted_client_secret = encrypt_secret(data.client_secret)
    integration.access_token = token
    integration.token_expires_at = expires_at
    integration.status = "connected"
    db.commit()
    db.refresh(integration)
    return integration, sample_count


async def client_from_integration(db: Session, integration: KiotVietIntegration) -> KiotVietClient:
    secret = decrypt_secret(integration.encrypted_client_secret)
    client = KiotVietClient(integration.retailer, integration.client_id, secret, integration.access_token)
    now = datetime.now(UTC)
    if integration.token_expires_at is None or integration.token_expires_at <= now:
        token, expires_at = await client.fetch_token()
        integration.access_token = token
        integration.token_expires_at = expires_at
        db.commit()
    return client


def _upsert_product(db: Session, workspace_id: int, product: dict) -> ProductCache:
    kv_id = int(product["id"])
    row = db.scalar(
        select(ProductCache).where(
            ProductCache.workspace_id == workspace_id,
            ProductCache.kiotviet_product_id == kv_id,
        )
    )
    if row is None:
        row = ProductCache(workspace_id=workspace_id, kiotviet_product_id=kv_id, name=product.get("name") or "Sản phẩm")
        db.add(row)
    row.code = product.get("code")
    row.name = product.get("name") or row.name
    row.base_price = Decimal(str(product.get("basePrice") or product.get("base_price") or 0))
    row.stock = product_stock(product)
    row.raw_json = product
    return row


async def sync_products(db: Session, *, page_size: int = 100) -> int:
    integration = get_integration(db)
    if not integration:
        return 0
    client = await client_from_integration(db, integration)
    payload = await client.list_products(page_size=page_size)
    products = extract_products(payload)
    for product in products:
        if product.get("id"):
            _upsert_product(db, integration.workspace_id, product)
    integration.last_sync_at = datetime.now(UTC)
    db.commit()
    return len(products)


async def list_cached_or_remote_products(db: Session, search: str | None = None) -> list[ProductCache]:
    query = select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID).order_by(ProductCache.name).limit(50)
    if search:
        query = select(ProductCache).where(
            ProductCache.workspace_id == DEFAULT_WORKSPACE_ID,
            ProductCache.name.ilike(f"%{search}%"),
        ).order_by(ProductCache.name).limit(50)
    rows = list(db.scalars(query))
    if rows or not search:
        return rows
    integration = get_integration(db)
    if not integration:
        return []
    client = await client_from_integration(db, integration)
    payload = await client.list_products(page_size=20, search_term=search)
    products = extract_products(payload)
    for product in products:
        if product.get("id"):
            rows.append(_upsert_product(db, integration.workspace_id, product))
    db.commit()
    return rows

