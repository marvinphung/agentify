from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, JSON, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductCache(Base):
    __tablename__ = "products_cache"
    __table_args__ = (
        Index("ix_products_workspace_kv_id", "workspace_id", "kiotviet_product_id"),
        Index("ix_products_workspace_name", "workspace_id", "name"),
        Index("ix_products_workspace_code", "workspace_id", "code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    kiotviet_product_id: Mapped[int] = mapped_column(nullable=False)
    code: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    base_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    stock: Mapped[int] = mapped_column(default=0)
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

