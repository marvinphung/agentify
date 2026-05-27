from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.schemas import AuthSessionResponse, UserResponse, WorkspaceResponse
from app.models import GHNIntegration, KiotVietIntegration, User, Workspace, WorkspaceMembership
from app.security import create_access_token, hash_password, verify_password
from app.shared.workspace import sync_workspace_sequence


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_user_session(db: Session, *, name: str, email: str, password: str, shop_name: str) -> AuthSessionResponse:
    normalized = normalize_email(email)
    existing = db.scalar(select(User).where(User.email == normalized))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email này đã được đăng ký.")

    user = User(name=name.strip(), email=normalized, password_hash=hash_password(password))
    sync_workspace_sequence(db)
    workspace = Workspace(name=shop_name.strip())
    db.add_all([user, workspace])
    db.flush()
    db.add(WorkspaceMembership(user_id=user.id, workspace_id=workspace.id, role="owner"))
    db.commit()
    db.refresh(user)
    db.refresh(workspace)
    return build_auth_session(db, user, workspace)


def authenticate_user(db: Session, *, email: str, password: str) -> AuthSessionResponse:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng.")
    workspace = primary_workspace_for_user(db, user)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản chưa có workspace.")
    return build_auth_session(db, user, workspace)


def primary_workspace_for_user(db: Session, user: User) -> Workspace | None:
    return db.scalar(
        select(Workspace)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == user.id)
        .order_by(WorkspaceMembership.id)
        .limit(1)
    )


def onboarding_status(db: Session, workspace_id: int) -> str:
    kiot = db.scalar(
        select(KiotVietIntegration).where(
            KiotVietIntegration.workspace_id == workspace_id,
            KiotVietIntegration.status == "connected",
        )
    )
    if not kiot:
        return "needs_kiotviet"
    ghn = db.scalar(
        select(GHNIntegration).where(
            GHNIntegration.workspace_id == workspace_id,
            GHNIntegration.status == "connected",
        )
    )
    if not ghn:
        return "needs_ghn"
    return "ready"


def build_auth_session(db: Session, user: User, workspace: Workspace) -> AuthSessionResponse:
    return AuthSessionResponse(
        access_token=create_access_token(user.id),
        user=UserResponse(id=user.id, name=user.name, email=user.email),
        workspace=WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            onboarding_status=onboarding_status(db, workspace.id),
        ),
    )


def build_me_response(db: Session, user: User, workspace: Workspace):
    return {
        "user": UserResponse(id=user.id, name=user.name, email=user.email),
        "workspace": WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            onboarding_status=onboarding_status(db, workspace.id),
        ),
    }
