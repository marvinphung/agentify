from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.auth.service import build_me_response, create_user_session
from app.database import Base
from app.models import GHNIntegration, KiotVietIntegration, User, Workspace, WorkspaceMembership
from app.security import verify_access_token


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


def test_register_creates_user_workspace_membership_and_token() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        session = create_user_session(
            db,
            name="Lumi Beauty",
            email="Owner@LumiBeauty.vn",
            password="12345678",
            shop_name="Lumi Beauty",
        )

        assert session.user.email == "owner@lumibeauty.vn"
        assert session.workspace.name == "Lumi Beauty"
        assert session.workspace.onboarding_status == "needs_kiotviet"
        assert verify_access_token(session.access_token) == session.user.id
        assert db.scalar(select(User)).id == session.user.id
        assert db.scalar(select(Workspace)).id == session.workspace.id
        assert db.scalar(select(WorkspaceMembership)).workspace_id == session.workspace.id


def test_onboarding_status_moves_from_kiotviet_to_ghn_to_ready() -> None:
    SessionLocal = _session()
    with SessionLocal() as db:
        session = create_user_session(
            db,
            name="Owner",
            email="owner@example.com",
            password="12345678",
            shop_name="Demo Shop",
        )
        workspace_id = session.workspace.id

        assert build_me_response(db, db.get(User, session.user.id), db.get(Workspace, workspace_id))["workspace"].onboarding_status == "needs_kiotviet"

        db.add(
            KiotVietIntegration(
                workspace_id=workspace_id,
                retailer="shop-demo",
                client_id="client-id",
                encrypted_client_secret="secret",
                status="connected",
            )
        )
        db.commit()
        assert build_me_response(db, db.get(User, session.user.id), db.get(Workspace, workspace_id))["workspace"].onboarding_status == "needs_ghn"

        db.add(
            GHNIntegration(
                workspace_id=workspace_id,
                shop_id="200457",
                env="sandbox",
                status="connected",
            )
        )
        db.commit()
        assert build_me_response(db, db.get(User, session.user.id), db.get(Workspace, workspace_id))["workspace"].onboarding_status == "ready"
