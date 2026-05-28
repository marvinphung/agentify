from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.database import Base
from app.models import ProductCache
from app.shared.workspace import DEFAULT_WORKSPACE_ID, ensure_default_workspace


def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


def seed_product(
    db: Session,
    *,
    kv_id: int,
    code: str,
    name: str,
    price: int,
    stock: int,
    raw: dict | None = None,
) -> ProductCache:
    product = ProductCache(
        workspace_id=DEFAULT_WORKSPACE_ID,
        kiotviet_product_id=kv_id,
        code=code,
        name=name,
        base_price=Decimal(str(price)),
        stock=stock,
        raw_json=raw or {},
    )
    db.add(product)
    db.flush()
    return product


def seed_catalog(db: Session) -> None:
    ensure_default_workspace(db)
    seed_product(
        db,
        kv_id=910001,
        code="SUNCARE-AQUA",
        name="SunCare Aqua SPF50+",
        price=320000,
        stock=20,
        raw={"skin_types": ["da dầu", "da hỗn hợp"], "texture": "gel mỏng nhẹ"},
    )
    seed_product(
        db,
        kv_id=910002,
        code="DERMA-SHIELD-SENSITIVE",
        name="Derma Shield Sensitive SPF50",
        price=390000,
        stock=12,
        raw={"skin_types": ["da nhạy cảm", "da treatment"], "notes": "không cồn, không hương liệu"},
    )
    seed_product(
        db,
        kv_id=910003,
        code="MOIST-UV-CREAM",
        name="Moist UV Cream SPF50+",
        price=350000,
        stock=10,
        raw={"skin_types": ["da khô"], "notes": "có dưỡng ẩm"},
    )
    seed_product(db, kv_id=910004, code="RETINOL-03", name="Retinol Night Repair 0.3%", price=420000, stock=9)
    seed_product(db, kv_id=910005, code="GENTLE-FOAM", name="Sữa rửa mặt Gentle Foam", price=180000, stock=18)
    seed_product(db, kv_id=910006, code="CLEAN-GENTLE", name="Cleanser Gentle Foam", price=190000, stock=15)
    seed_product(db, kv_id=910007, code="NIA-10", name="Serum Niacinamide 10%", price=260000, stock=21)
    seed_product(db, kv_id=910008, code="CERAMIDE-CREAM", name="Kem dưỡng Ceramide Cream", price=280000, stock=16)
    db.commit()
