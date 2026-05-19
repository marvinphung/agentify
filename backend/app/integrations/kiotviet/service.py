from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.kiotviet.client import KiotVietClient, extract_products, product_stock
from app.integrations.kiotviet.schemas import KiotVietConnectRequest
from app.config import get_settings
from app.models import KiotVietIntegration, ProductCache
from app.security import decrypt_secret, encrypt_secret
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


COSMETIC_DEMO_PRODUCTS = [
    {"id": 900001, "code": "MP001", "name": "Serum vitamin C sáng da 30ml", "basePrice": 320000, "stock": 18},
    {"id": 900002, "code": "MP002", "name": "Kem chống nắng SPF50 PA++++", "basePrice": 280000, "stock": 24},
    {"id": 900003, "code": "MP003", "name": "Tẩy trang dịu nhẹ hoa cúc 500ml", "basePrice": 210000, "stock": 15},
    {"id": 900004, "code": "MP004", "name": "Sữa rửa mặt trà xanh 150ml", "basePrice": 165000, "stock": 30},
    {"id": 900005, "code": "MP005", "name": "Toner cấp ẩm rau má 250ml", "basePrice": 190000, "stock": 22},
    {"id": 900006, "code": "MP006", "name": "Kem dưỡng phục hồi B5 50ml", "basePrice": 260000, "stock": 16},
    {"id": 900007, "code": "MP007", "name": "Mặt nạ đất sét kiềm dầu 100g", "basePrice": 230000, "stock": 12},
    {"id": 900008, "code": "MP008", "name": "Son dưỡng môi hồng tự nhiên", "basePrice": 95000, "stock": 35},
    {"id": 900009, "code": "MP009", "name": "Kem mắt giảm quầng thâm 20ml", "basePrice": 310000, "stock": 9},
    {"id": 900010, "code": "MP010", "name": "Gel trị mụn chấm điểm 15ml", "basePrice": 145000, "stock": 20},
    {"id": 900011, "code": "MP011", "name": "Dầu gội thảo mộc giảm gãy rụng 300ml", "basePrice": 175000, "stock": 14},
    {"id": 900012, "code": "MP012", "name": "Sữa tắm hương hoa anh đào 500ml", "basePrice": 155000, "stock": 26},
]

KIOTVIET_DEMO_CATEGORY_NAME = "Mỹ phẩm demo Agentify"
NON_COSMETIC_DEMO_PRODUCT_NAMES = {
    "Bánh AFC 200g",
    "Coca chai 390ml",
    "Pepsi chai 400ml",
    "Hộp phở bò phố cổ",
    "Mì bò hầm cải chua Reeva hộp 100g",
    "Rượu Chivas Regal 12",
    "Rượu men 500ml",
    "Thuốc Marl đỏ",
    "Thuốc craven loại nhỏ",
    "Thuốc lá 555 nội",
    "Thăng long mềm",
    "Vinataba Slims",
}


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
    raw_stock = product_stock(product)
    row.stock = raw_stock if raw_stock > 0 else get_settings().demo_stock_fallback
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


def seed_cosmetic_products(db: Session) -> int:
    ensure_default_workspace(db)
    for row in db.scalars(select(ProductCache).where(ProductCache.workspace_id == DEFAULT_WORKSPACE_ID)):
        db.delete(row)
    db.flush()
    for product in COSMETIC_DEMO_PRODUCTS:
        _upsert_product(db, DEFAULT_WORKSPACE_ID, product)
    db.commit()
    return len(COSMETIC_DEMO_PRODUCTS)


async def create_cosmetic_products_in_kiotviet(db: Session) -> tuple[int, int, int]:
    integration = get_integration(db)
    if not integration:
        raise ValueError("Chưa kết nối KiotViet.")
    client = await client_from_integration(db, integration)
    category_id = await _ensure_demo_category(client)
    branch_id = await _first_branch_id(client)
    existing_products = extract_products(await client.list_products(page_size=100))
    await _remove_non_cosmetic_products(client, existing_products)
    for row in db.scalars(select(ProductCache).where(ProductCache.workspace_id == integration.workspace_id)):
        db.delete(row)
    db.flush()
    existing_products = [product for product in existing_products if product.get("name") not in NON_COSMETIC_DEMO_PRODUCT_NAMES]
    existing_by_code = {product.get("code"): product for product in existing_products if product.get("code")}

    created = 0
    existing = 0
    kiot_products: list[dict] = []
    for product in COSMETIC_DEMO_PRODUCTS:
        if product["code"] in existing_by_code:
            existing += 1
            kiot_products.append(existing_by_code[product["code"]])
            continue

        payload = {
            "name": product["name"],
            "code": product["code"],
            "fullName": product["name"],
            "categoryId": category_id,
            "allowsSale": True,
            "hasVariants": False,
            "description": "Sản phẩm mỹ phẩm demo do Agentify tạo để kiểm thử luồng AI bán hàng.",
            "unit": "sản phẩm",
            "basePrice": product["basePrice"],
            "inventories": [{"branchId": branch_id, "onHand": product["stock"], "cost": product["basePrice"] * 0.65}],
        }
        response = await client.create_product(payload)
        created_product = response.get("data") if isinstance(response.get("data"), dict) else response
        created += 1
        kiot_products.append(created_product)

    for product in kiot_products:
        if product.get("id"):
            _upsert_product(db, integration.workspace_id, product)
    db.commit()
    return created, existing, len(kiot_products)


async def _remove_non_cosmetic_products(client: KiotVietClient, products: list[dict]) -> None:
    for product in products:
        product_id = product.get("id")
        if product_id and product.get("name") in NON_COSMETIC_DEMO_PRODUCT_NAMES:
            try:
                await client.delete_product(int(product_id))
            except Exception:
                pass


async def _ensure_demo_category(client: KiotVietClient) -> int:
    payload = await client.list_categories(page_size=100)
    categories = payload.get("data") or []
    for category in categories:
        if category.get("categoryName") == KIOTVIET_DEMO_CATEGORY_NAME:
            return int(category["categoryId"])
    created = await client.create_category(KIOTVIET_DEMO_CATEGORY_NAME)
    data = created.get("data") if isinstance(created.get("data"), dict) else created
    return int(data["categoryId"])


async def _first_branch_id(client: KiotVietClient) -> int:
    payload = await client.list_branches(page_size=100)
    branches = payload.get("data") or []
    if not branches:
        raise ValueError("KiotViet chưa có chi nhánh để tạo tồn kho.")
    return int(branches[0]["id"])


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
