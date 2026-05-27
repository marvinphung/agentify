from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    integrations = relationship("KiotVietIntegration", back_populates="workspace")
    zalo_integrations = relationship("ZaloIntegration", back_populates="workspace")
    ghn_integrations = relationship("GHNIntegration", back_populates="workspace")
    memberships = relationship("WorkspaceMembership", back_populates="workspace")
