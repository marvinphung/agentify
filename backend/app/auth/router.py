from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_workspace
from app.auth.schemas import AuthMeResponse, AuthSessionResponse, LoginRequest, RegisterRequest
from app.auth.service import authenticate_user, build_me_response, create_user_session
from app.database import get_db
from app.models import User, Workspace

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthSessionResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    return create_user_session(
        db,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        shop_name=payload.shop_name,
    )


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    return authenticate_user(db, email=payload.email, password=payload.password)


@router.get("/me", response_model=AuthMeResponse)
def me(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    return build_me_response(db, user, workspace)
