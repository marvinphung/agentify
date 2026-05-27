from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.service import primary_workspace_for_user
from app.database import get_db
from app.models import User, Workspace
from app.security import verify_access_token


def _token_from_authorization(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


def get_optional_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    token = _token_from_authorization(authorization)
    if not token:
        return None
    user_id = verify_access_token(token)
    if not user_id:
        return None
    return db.get(User, user_id)


def get_current_user(user: User | None = Depends(get_optional_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cần đăng nhập để tiếp tục.")
    return user


def get_current_workspace(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workspace:
    workspace = primary_workspace_for_user(db, user)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản chưa có workspace.")
    return workspace
