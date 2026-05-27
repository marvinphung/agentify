from datetime import datetime

from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class KiotVietIntegration(Base):
    __tablename__ = "kiotviet_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    retailer: Mapped[str] = mapped_column(String(255), nullable=False)
    client_id: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_client_secret: Mapped[str] = mapped_column(Text, nullable=False)
    access_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="connected")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="integrations")


class ZaloIntegration(Base):
    __tablename__ = "zalo_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True, unique=True)
    oa_id: Mapped[str | None] = mapped_column(String(255))
    access_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="disconnected")
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="zalo_integrations")


class GHNIntegration(Base):
    __tablename__ = "ghn_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True, unique=True, nullable=False)
    shop_id: Mapped[str] = mapped_column(String(100), nullable=False)
    encrypted_token: Mapped[str | None] = mapped_column(Text)
    env: Mapped[str] = mapped_column(String(50), default="sandbox")
    from_name: Mapped[str | None] = mapped_column(String(255))
    from_phone: Mapped[str | None] = mapped_column(String(50))
    from_address: Mapped[str | None] = mapped_column(Text)
    from_district_id: Mapped[int] = mapped_column(default=0)
    from_ward_code: Mapped[str] = mapped_column(String(50), default="")
    status: Mapped[str] = mapped_column(String(50), default="connected")
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="ghn_integrations")
