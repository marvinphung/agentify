# Production Auth + Onboarding + Demo Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build one production app where real shop owners register/login and connect KiotViet + GHN, while the landing page `Chat thử` remains a public demo shortcut that uses the already-configured KiotViet/GHN credentials from `backend/.env`.

**Architecture:** Keep the existing demo/default workspace path for unauthenticated demo chat, and add authenticated production workspaces for real shops. Production integration credentials are stored per workspace in the database with secrets encrypted via the existing `app.security.encrypt_secret`; demo integration credentials continue to come from `.env`.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, existing `create_tables()` bootstrap, Pydantic schemas, encrypted secrets with Fernet, Vite React single-page app, existing KiotViet/GHN clients, existing Azure OpenAI agent.

**Execution status, 2026-05-27:** Implemented. Backend docker stack was rebuilt, frontend dev server is running on port `5173`, auth/GHN smoke checks passed, frontend build passed, and targeted backend tests passed after fixing the delivery-time reply regression. Full backend test run before that fix was `31 passed, 1 failed`; the failed scenario was rerun and passed.

---

## Scope

### In Scope

- Add email/password registration and login for shop owners.
- Add JWT-style bearer session auth for production dashboard APIs.
- Add `User`, `WorkspaceMembership`, and `GHNIntegration` database models.
- Keep existing `DEFAULT_WORKSPACE_ID` for public demo chat.
- Add production onboarding:
  - KiotViet credential form.
  - KiotViet detected-shop preview.
  - KiotViet authorize screen.
  - GHN credential form.
  - GHN detected-shop/warehouse preview.
  - GHN authorize screen.
  - Success screen then management dashboard.
- Add guide video display from:
  - `/guide/kiotviet/video_huong_dan_lay_connect_kiotviet.mp4`
  - `/guide/ghn/video_huong_dan_connect_ghn.mp4`
- Make dashboard APIs workspace-aware for authenticated production users.
- Keep `Chat thử` public and routed to demo chat using `.env` credentials.

### Out of Scope

- Multi-tenant billing.
- Password reset by email.
- Production OAuth with KiotViet/GHN, because current flow uses API credentials manually entered by shop owner.
- Real Zalo OA connect.
- Return/refund video recognition.

---

## Product Flows

### Flow A: Public Demo Chat

1. User opens landing page.
2. User clicks `Chat thử`.
3. Frontend routes to `/demo_chat` or the existing `/user_chat`.
4. No login required.
5. Backend uses `DEFAULT_WORKSPACE_ID` and `.env` credentials:
   - `KIOTVIET_RETAILER`
   - `KIOTVIET_CLIENT_ID`
   - `KIOTVIET_CLIENT_SECRET`
   - `GHN_TOKEN`
   - `GHN_SHOP_ID`
   - GHN warehouse defaults
6. Agent can consult products, create order/invoice, and create GHN sandbox shipment.

### Flow B: Production Owner Onboarding

1. User opens landing page.
2. User clicks `Đăng nhập` or `Dùng cho shop`.
3. User registers or logs in.
4. Backend returns bearer token plus workspace summary.
5. If workspace is not fully connected, frontend routes to onboarding.
6. KiotViet step:
   - User enters `Tên shop`, `Mã khách hàng`, `Mã bí mật`.
   - User can watch guide video.
   - Backend validates credentials by fetching token and sample products.
   - Frontend shows detected shop/retailer and authorize screen.
   - User clicks `Kết nối KiotViet`.
   - Backend saves encrypted secret and syncs products.
7. GHN step:
   - User enters `Mã khách hàng GHN` / `Shop ID`.
   - User can watch guide video.
   - Backend validates GHN access using server-configured `GHN_TOKEN` plus user-entered `shop_id`, or later an account-level token if GHN requires one.
   - Frontend shows detected shop/warehouse and authorize screen.
   - User clicks `Kết nối GHN`.
   - Backend saves GHN integration for that workspace.
8. Frontend shows success screen.
9. Frontend routes to shop management dashboard.

---

## File Structure

### Backend Files

- Modify `backend/app/models/workspace.py`
  - Add relationships to users/memberships and GHN integrations.

- Modify `backend/app/models/integration.py`
  - Keep `KiotVietIntegration`.
  - Add `GHNIntegration`.
  - Optionally add `mode` or rely on `workspace_id` to separate demo/default vs production workspaces.

- Create `backend/app/models/user.py`
  - `User` model.
  - `WorkspaceMembership` model.

- Modify `backend/app/models/__init__.py`
  - Export new models.

- Create `backend/app/auth/schemas.py`
  - Request/response schemas for register, login, session.

- Create `backend/app/auth/service.py`
  - Password hashing, user creation, login validation, token creation, workspace creation.

- Create `backend/app/auth/dependencies.py`
  - `get_current_user()`.
  - `get_current_workspace()`.

- Create `backend/app/auth/router.py`
  - `/api/auth/register`
  - `/api/auth/login`
  - `/api/auth/me`
  - `/api/auth/logout` can be client-side only, so backend endpoint is optional.

- Modify `backend/app/security.py`
  - Add password hashing.
  - Add token signing/verification.

- Modify `backend/app/config.py`
  - Add session settings:
    - `access_token_expire_minutes`
    - `password_hash_iterations` if using PBKDF2.
  - Prefer stdlib PBKDF2 to avoid adding dependencies unless `passlib` is added intentionally.

- Modify `backend/app/integrations/kiotviet/schemas.py`
  - Add production preview and authorize schemas.

- Modify `backend/app/integrations/kiotviet/router.py`
  - Keep current demo endpoints.
  - Add authenticated production endpoints:
    - `POST /api/integrations/kiotviet/preview`
    - `POST /api/integrations/kiotviet/authorize`

- Modify `backend/app/integrations/kiotviet/service.py`
  - Add workspace-aware connection functions.
  - Keep `connect_kiotviet_from_env()` for demo.

- Modify `backend/app/integrations/ghn/schemas.py`
  - Add GHN preview and authorize schemas.

- Modify `backend/app/integrations/ghn/client.py`
  - Allow token/shop_id override for production workspace calls.
  - Add simple shop validation method.

- Modify `backend/app/integrations/ghn/service.py`
  - Add workspace-aware shipment client lookup.
  - Keep `.env` path for demo/default workspace.

- Modify `backend/app/shipments/router.py`
  - Add authenticated workspace status endpoint or make existing endpoint detect auth if present.

- Modify `backend/app/agent/tools.py`
  - Ensure demo chat continues using `DEFAULT_WORKSPACE_ID`.
  - Add optional workspace-aware path for future authenticated shop chat.

- Modify `backend/app/main.py`
  - Include auth router.

- Add tests:
  - `backend/tests/test_auth.py`
  - `backend/tests/test_production_onboarding.py`
  - Extend `backend/tests/test_ghn_shipping.py`
  - Extend `backend/tests/test_order_confirmation_flow.py` only if workspace routing changes.

### Frontend Files

- Modify `frontend/src/app/App.tsx`
  - Add app modes/routes:
    - `landing`
    - `auth-login`
    - `auth-register`
    - `prod-kiotviet-form`
    - `prod-kiotviet-authorize`
    - `prod-ghn-form`
    - `prod-ghn-authorize`
    - `prod-onboarding-success`
    - `manage`
    - `user_chat` or `demo_chat`
  - Add token storage and authenticated API request helper.
  - Keep `Chat thử` bypassing auth.

- Modify `frontend/src/app/components/LandingPage.tsx`
  - Wire `Chat thử` to public demo chat.
  - Wire shop CTA to login/register.

- Optionally create focused frontend modules if `App.tsx` becomes too large:
  - `frontend/src/app/auth.ts`
  - `frontend/src/app/api.ts`
  - `frontend/src/app/onboarding.tsx`

- Use existing guide video files:
  - `frontend/public/guide/kiotviet/video_huong_dan_lay_connect_kiotviet.mp4`
  - `frontend/public/guide/ghn/video_huong_dan_connect_ghn.mp4`

---

## Database Design

### `users`

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

### `workspace_memberships`

```python
class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="owner")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

Add unique constraint:

```python
UniqueConstraint("user_id", "workspace_id", name="uq_workspace_membership_user_workspace")
```

### `ghn_integrations`

```python
class GHNIntegration(Base):
    __tablename__ = "ghn_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
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
```

### Workspace Separation Rule

- `DEFAULT_WORKSPACE_ID` remains demo workspace.
- Authenticated users get a new workspace when registering.
- Production APIs must use `get_current_workspace()`.
- Demo APIs must explicitly use `DEFAULT_WORKSPACE_ID`.
- Do not let unauthenticated requests read production integration rows.

---

## Backend API Contract

### Auth

#### `POST /api/auth/register`

Request:

```json
{
  "name": "Lumi Beauty",
  "email": "owner@example.com",
  "password": "12345678",
  "shop_name": "Lumi Beauty"
}
```

Response:

```json
{
  "access_token": "signed-token",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Lumi Beauty",
    "email": "owner@example.com"
  },
  "workspace": {
    "id": 2,
    "name": "Lumi Beauty",
    "onboarding_status": "needs_kiotviet"
  }
}
```

#### `POST /api/auth/login`

Request:

```json
{
  "email": "owner@example.com",
  "password": "12345678"
}
```

Response: same as register.

#### `GET /api/auth/me`

Headers:

```http
Authorization: Bearer signed-token
```

Response:

```json
{
  "user": {
    "id": 1,
    "name": "Lumi Beauty",
    "email": "owner@example.com"
  },
  "workspace": {
    "id": 2,
    "name": "Lumi Beauty",
    "onboarding_status": "ready"
  }
}
```

### Production KiotViet

#### `POST /api/integrations/kiotviet/preview`

Authenticated.

Request:

```json
{
  "retailer": "shophihi123",
  "client_id": "client-id",
  "client_secret": "client-secret"
}
```

Response:

```json
{
  "status": "valid",
  "retailer": "shophihi123",
  "sample_product_count": 3,
  "detected_shop_name": "shophihi123"
}
```

Implementation note:
- This endpoint validates credentials but does not persist the secret.
- Frontend stores the form values in component state only until authorize.

#### `POST /api/integrations/kiotviet/authorize`

Authenticated.

Request:

```json
{
  "retailer": "shophihi123",
  "client_id": "client-id",
  "client_secret": "client-secret"
}
```

Response:

```json
{
  "status": "connected",
  "retailer": "shophihi123",
  "sample_product_count": 3,
  "synced_product_count": 50
}
```

Implementation note:
- Re-validates credentials server-side.
- Saves encrypted client secret.
- Saves token and expiry.
- Syncs product cache for authenticated workspace.

### Production GHN

#### `POST /api/integrations/ghn/preview`

Authenticated.

Request:

```json
{
  "shop_id": "200457"
}
```

Response:

```json
{
  "status": "valid",
  "env": "sandbox",
  "shop_id": "200457",
  "from_name": "Lumi Beauty",
  "from_phone": "0878359003",
  "from_address": "19 P. Lê Thanh Nghị, Bạch Mai, Hai Bà Trưng, Hà Nội, Vietnam"
}
```

Implementation note:
- For this MVP, use server `GHN_TOKEN` and user-entered `shop_id`.
- If GHN requires a token per shop later, add token input in this same form without changing the onboarding state machine.

#### `POST /api/integrations/ghn/authorize`

Authenticated.

Request:

```json
{
  "shop_id": "200457"
}
```

Response:

```json
{
  "status": "connected",
  "env": "sandbox",
  "shop_id": "200457",
  "from_name": "Lumi Beauty",
  "from_phone": "0878359003",
  "from_address": "19 P. Lê Thanh Nghị, Bạch Mai, Hai Bà Trưng, Hà Nội, Vietnam"
}
```

### Demo Chat

Keep existing demo endpoint path if possible:

```http
POST /api/channels/zalo/messages
```

Behavior:

- Public.
- Uses `DEFAULT_WORKSPACE_ID`.
- Uses `.env` KiotViet/GHN.
- Does not require bearer token.

If clearer routing is desired, add:

```http
POST /api/demo/chat/messages
```

and internally call the same service with `workspace_id=DEFAULT_WORKSPACE_ID`.

---

## Frontend State Machine

### Top-Level Routes/Modes

```ts
type AppMode =
  | 'landing'
  | 'auth-login'
  | 'auth-register'
  | 'prod-kiotviet-form'
  | 'prod-kiotviet-authorize'
  | 'prod-ghn-form'
  | 'prod-ghn-authorize'
  | 'prod-onboarding-success'
  | 'manage';
```

`/user_chat` or `/demo_chat` remains separate:

```ts
if (pathname === '/user_chat' || pathname === '/demo_chat') {
  return <UserChatScreen demoMode />;
}
```

### Landing CTA Rules

- `Chat thử`
  - `navigateTo('/user_chat')` or `navigateTo('/demo_chat')`.
  - No auth check.

- `Dùng cho shop` / `Đăng nhập`
  - If token exists, call `/api/auth/me`.
  - If onboarding incomplete, route to correct onboarding step.
  - If ready, route to `manage`.
  - If no token, route to login/register.

### Onboarding Step Resolution

Frontend should not guess readiness from local state. It should call `/api/auth/me` and use:

```ts
type OnboardingStatus =
  | 'needs_kiotviet'
  | 'needs_ghn'
  | 'ready';
```

Backend computes:

- `needs_kiotviet` when workspace has no connected KiotViet integration.
- `needs_ghn` when KiotViet connected but GHN not connected.
- `ready` when both are connected.

---

## Implementation Tasks

### Task 1: Backend Auth Models

**Files:**
- Create: `backend/app/models/user.py`
- Modify: `backend/app/models/workspace.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_auth.py`

- [x] **Step 1: Add user and membership models**

Create `backend/app/models/user.py`:

```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    memberships = relationship("WorkspaceMembership", back_populates="user")


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("user_id", "workspace_id", name="uq_workspace_membership_user_workspace"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="owner")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="memberships")
    workspace = relationship("Workspace", back_populates="memberships")
```

- [x] **Step 2: Add workspace relationship**

Modify `backend/app/models/workspace.py`:

```python
    memberships = relationship("WorkspaceMembership", back_populates="workspace")
    ghn_integrations = relationship("GHNIntegration", back_populates="workspace")
```

- [x] **Step 3: Export models**

Modify `backend/app/models/__init__.py` to include:

```python
from app.models.user import User, WorkspaceMembership

__all__ = [
    # existing exports
    "User",
    "WorkspaceMembership",
]
```

- [x] **Step 4: Write model bootstrap test**

Add to `backend/tests/test_auth.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, Workspace, WorkspaceMembership


def test_auth_tables_can_be_created() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    with SessionLocal() as db:
        workspace = Workspace(name="Shop A")
        user = User(email="owner@example.com", name="Owner", password_hash="hash")
        db.add_all([workspace, user])
        db.flush()
        db.add(WorkspaceMembership(user_id=user.id, workspace_id=workspace.id, role="owner"))
        db.commit()
        assert user.id is not None
```

- [x] **Step 5: Run test**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_auth.py -q
```

Expected:

```text
1 passed
```

### Task 2: Backend Security and Auth Router

**Files:**
- Modify: `backend/app/security.py`
- Create: `backend/app/auth/schemas.py`
- Create: `backend/app/auth/service.py`
- Create: `backend/app/auth/dependencies.py`
- Create: `backend/app/auth/router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_auth.py`

- [x] **Step 1: Add password and token helpers**

Extend `backend/app/security.py`:

```python
import hmac
import json
import secrets
import time
from datetime import timedelta


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 210_000)
    return f"pbkdf2_sha256$210000${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
    return hmac.compare_digest(digest.hex(), expected)


def create_access_token(payload: dict, expires_delta: timedelta) -> str:
    expires_at = int(time.time() + expires_delta.total_seconds())
    body = {**payload, "exp": expires_at}
    encoded = base64.urlsafe_b64encode(json.dumps(body, separators=(",", ":")).encode("utf-8")).decode("utf-8")
    signature = hmac.new(get_settings().secret_key.encode("utf-8"), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def decode_access_token(token: str) -> dict | None:
    try:
        encoded, signature = token.split(".", 1)
    except ValueError:
        return None
    expected = hmac.new(get_settings().secret_key.encode("utf-8"), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(encoded.encode("utf-8")))
    except (ValueError, json.JSONDecodeError):
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload
```

- [x] **Step 2: Add auth schemas**

Create `backend/app/auth/schemas.py`:

```python
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)
    shop_name: str = Field(min_length=2)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    onboarding_status: str


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    workspace: WorkspaceResponse
```

Note: If `EmailStr` requires `email-validator`, either add dependency or use plain `str` with local validation. For fastest MVP, plain `str` is acceptable if dependency install is risky.

- [x] **Step 3: Add auth service**

Create `backend/app/auth/service.py`:

```python
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.schemas import AuthSessionResponse, RegisterRequest, UserResponse, WorkspaceResponse
from app.config import get_settings
from app.models import GHNIntegration, KiotVietIntegration, User, Workspace, WorkspaceMembership
from app.security import create_access_token, hash_password, verify_password


def onboarding_status(db: Session, workspace_id: int) -> str:
    kiot = db.scalar(select(KiotVietIntegration).where(KiotVietIntegration.workspace_id == workspace_id, KiotVietIntegration.status == "connected"))
    if not kiot:
        return "needs_kiotviet"
    ghn = db.scalar(select(GHNIntegration).where(GHNIntegration.workspace_id == workspace_id, GHNIntegration.status == "connected"))
    if not ghn:
        return "needs_ghn"
    return "ready"


def create_user_session(db: Session, user: User, workspace: Workspace) -> AuthSessionResponse:
    token = create_access_token(
        {"sub": str(user.id), "workspace_id": workspace.id},
        expires_delta=timedelta(minutes=getattr(get_settings(), "access_token_expire_minutes", 60 * 24 * 7)),
    )
    return AuthSessionResponse(
        access_token=token,
        user=UserResponse(id=user.id, name=user.name, email=user.email),
        workspace=WorkspaceResponse(id=workspace.id, name=workspace.name, onboarding_status=onboarding_status(db, workspace.id)),
    )


def register_user(db: Session, payload: RegisterRequest) -> AuthSessionResponse:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise ValueError("Email đã được đăng ký.")
    user = User(email=payload.email.lower(), name=payload.name, password_hash=hash_password(payload.password))
    workspace = Workspace(name=payload.shop_name)
    db.add_all([user, workspace])
    db.flush()
    db.add(WorkspaceMembership(user_id=user.id, workspace_id=workspace.id, role="owner"))
    db.commit()
    db.refresh(user)
    db.refresh(workspace)
    return create_user_session(db, user, workspace)


def authenticate_user(db: Session, email: str, password: str) -> AuthSessionResponse:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Email hoặc mật khẩu không đúng.")
    membership = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id))
    workspace = db.get(Workspace, membership.workspace_id) if membership else None
    if workspace is None:
        raise ValueError("Tài khoản chưa có workspace.")
    return create_user_session(db, user, workspace)
```

- [x] **Step 4: Add dependencies**

Create `backend/app/auth/dependencies.py`:

```python
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Workspace
from app.security import decode_access_token


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập.")
    payload = decode_access_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="Không tìm thấy user.")
    return user


def get_current_workspace(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Workspace:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Chưa đăng nhập.")
    payload = decode_access_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")
    workspace = db.get(Workspace, int(payload["workspace_id"]))
    if workspace is None:
        raise HTTPException(status_code=401, detail="Không tìm thấy workspace.")
    return workspace
```

- [x] **Step 5: Add router**

Create `backend/app/auth/router.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_workspace
from app.auth.schemas import AuthSessionResponse, LoginRequest, RegisterRequest
from app.auth.service import authenticate_user, create_user_session, register_user
from app.database import get_db
from app.models import User, Workspace

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthSessionResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    try:
        return register_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    try:
        return authenticate_user(db, payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.get("/me", response_model=AuthSessionResponse)
def me(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    return create_user_session(db, user, workspace)
```

- [x] **Step 6: Include router**

Modify `backend/app/main.py`:

```python
from app.auth.router import router as auth_router

app.include_router(auth_router)
```

- [x] **Step 7: Run tests**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_auth.py -q
```

Expected:

```text
all tests pass
```

### Task 3: GHN Integration Model and Workspace-Aware Client

**Files:**
- Modify: `backend/app/models/integration.py`
- Modify: `backend/app/models/workspace.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/integrations/ghn/client.py`
- Modify: `backend/app/integrations/ghn/schemas.py`
- Modify: `backend/app/integrations/ghn/service.py`
- Test: `backend/tests/test_ghn_shipping.py`

- [x] **Step 1: Add `GHNIntegration` model**

Add to `backend/app/models/integration.py`:

```python
class GHNIntegration(Base):
    __tablename__ = "ghn_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
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
```

- [x] **Step 2: Add schemas**

Add to `backend/app/integrations/ghn/schemas.py`:

```python
class GHNPreviewRequest(BaseModel):
    shop_id: str = Field(min_length=1)


class GHNConnectionResponse(BaseModel):
    status: str
    env: str
    shop_id: str
    from_name: str | None = None
    from_phone: str | None = None
    from_address: str | None = None
```

- [x] **Step 3: Make GHN client override-capable**

Modify `GHNClient.__init__`:

```python
def __init__(self, settings: Settings, *, token: str | None = None, shop_id: str | None = None):
    self.settings = settings
    self.base_url = settings.ghn_base_url.rstrip("/")
    self.token = token or settings.ghn_token
    self.shop_id = shop_id or settings.ghn_shop_id
```

Modify `_headers`:

```python
"Token": self.token,
...
headers["ShopId"] = str(self.shop_id)
```

Add validation method:

```python
def validate_shop(self) -> dict:
    response = httpx.get(
        f"{self.base_url}/v2/shop/all",
        headers=self._headers(),
        timeout=self.settings.request_timeout_seconds,
    )
    return self._parse_response(response)
```

If GHN sandbox does not support `/v2/shop/all` with the available token, fallback validation can use the configured warehouse fields and a lightweight status response, but the service must surface a clear message.

- [x] **Step 4: Add production connect service**

Add to `backend/app/integrations/ghn/service.py`:

```python
from datetime import UTC, datetime
from sqlalchemy import select
from app.models import GHNIntegration, Workspace


def get_ghn_integration(db: Session, workspace_id: int) -> GHNIntegration | None:
    return db.scalar(select(GHNIntegration).where(GHNIntegration.workspace_id == workspace_id))


def preview_ghn_shop(shop_id: str) -> GHNConnectionResponse:
    settings = get_settings()
    if not settings.ghn_token:
        raise ValueError("Backend chưa có GHN_TOKEN để kiểm tra GHN.")
    return GHNConnectionResponse(
        status="valid",
        env=settings.ghn_env,
        shop_id=shop_id,
        from_name=settings.ghn_from_name,
        from_phone=settings.ghn_from_phone,
        from_address=settings.ghn_from_address,
    )


def authorize_ghn_shop(db: Session, workspace: Workspace, shop_id: str) -> GHNConnectionResponse:
    settings = get_settings()
    if not settings.ghn_token:
        raise ValueError("Backend chưa có GHN_TOKEN để kết nối GHN.")
    integration = get_ghn_integration(db, workspace.id)
    if integration is None:
        integration = GHNIntegration(workspace_id=workspace.id, shop_id=shop_id)
        db.add(integration)
    integration.shop_id = shop_id
    integration.encrypted_token = encrypt_secret(settings.ghn_token)
    integration.env = settings.ghn_env
    integration.from_name = settings.ghn_from_name
    integration.from_phone = settings.ghn_from_phone
    integration.from_address = settings.ghn_from_address
    integration.from_district_id = settings.ghn_from_district_id
    integration.from_ward_code = settings.ghn_from_ward_code
    integration.status = "connected"
    integration.last_connected_at = datetime.now(UTC)
    db.commit()
    db.refresh(integration)
    return GHNConnectionResponse(
        status=integration.status,
        env=integration.env,
        shop_id=integration.shop_id,
        from_name=integration.from_name,
        from_phone=integration.from_phone,
        from_address=integration.from_address,
    )
```

- [x] **Step 5: Preserve demo shipment behavior**

In functions that create shipments:

```python
if order.workspace_id == DEFAULT_WORKSPACE_ID:
    client = GHNClient(settings)
    shop_id = settings.ghn_shop_id
else:
    integration = get_ghn_integration(db, order.workspace_id)
    token = decrypt_secret(integration.encrypted_token) if integration and integration.encrypted_token else settings.ghn_token
    client = GHNClient(settings, token=token, shop_id=integration.shop_id)
```

- [x] **Step 6: Test demo path still works**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_ghn_shipping.py -q
```

Expected:

```text
all tests pass
```

### Task 4: Production KiotViet Preview and Authorize

**Files:**
- Modify: `backend/app/integrations/kiotviet/schemas.py`
- Modify: `backend/app/integrations/kiotviet/service.py`
- Modify: `backend/app/integrations/kiotviet/router.py`
- Test: `backend/tests/test_production_onboarding.py`

- [x] **Step 1: Add schemas**

Add to `backend/app/integrations/kiotviet/schemas.py`:

```python
class KiotVietPreviewResponse(BaseModel):
    status: str
    retailer: str
    detected_shop_name: str
    sample_product_count: int


class KiotVietAuthorizeResponse(BaseModel):
    status: str
    retailer: str
    sample_product_count: int
    synced_product_count: int
```

- [x] **Step 2: Add workspace-aware service**

Add to `backend/app/integrations/kiotviet/service.py`:

```python
async def preview_kiotviet(data: KiotVietConnectRequest) -> KiotVietPreviewResponse:
    client = KiotVietClient(data.retailer, data.client_id, data.client_secret)
    await client.fetch_token()
    sample_payload = await client.list_products(page_size=3)
    sample_count = len(extract_products(sample_payload))
    return KiotVietPreviewResponse(
        status="valid",
        retailer=data.retailer,
        detected_shop_name=data.retailer,
        sample_product_count=sample_count,
    )


async def authorize_kiotviet_for_workspace(db: Session, workspace_id: int, data: KiotVietConnectRequest) -> KiotVietAuthorizeResponse:
    client = KiotVietClient(data.retailer, data.client_id, data.client_secret)
    token, expires_at = await client.fetch_token()
    sample_payload = await client.list_products(page_size=3)
    sample_count = len(extract_products(sample_payload))

    integration = db.scalar(select(KiotVietIntegration).where(KiotVietIntegration.workspace_id == workspace_id))
    if integration is None:
        integration = KiotVietIntegration(workspace_id=workspace_id, retailer=data.retailer, client_id=data.client_id, encrypted_client_secret="")
        db.add(integration)
    integration.retailer = data.retailer
    integration.client_id = data.client_id
    integration.encrypted_client_secret = encrypt_secret(data.client_secret)
    integration.access_token = token
    integration.token_expires_at = expires_at
    integration.status = "connected"
    db.commit()
    db.refresh(integration)
    synced = await sync_products(db)
    return KiotVietAuthorizeResponse(
        status=integration.status,
        retailer=integration.retailer,
        sample_product_count=sample_count,
        synced_product_count=synced,
    )
```

Important implementation correction:
- `sync_products(db)` currently likely reads `DEFAULT_WORKSPACE_ID`.
- Update it to accept `workspace_id: int = DEFAULT_WORKSPACE_ID`.
- Use `workspace_id` in every product cache query/write.

- [x] **Step 3: Add authenticated routes**

Add to `backend/app/integrations/kiotviet/router.py`:

```python
@router.post("/integrations/kiotviet/preview", response_model=KiotVietPreviewResponse)
async def preview(payload: KiotVietConnectRequest, _: Workspace = Depends(get_current_workspace)) -> KiotVietPreviewResponse:
    return await preview_kiotviet(payload)


@router.post("/integrations/kiotviet/authorize", response_model=KiotVietAuthorizeResponse)
async def authorize(
    payload: KiotVietConnectRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> KiotVietAuthorizeResponse:
    return await authorize_kiotviet_for_workspace(db, workspace.id, payload)
```

- [x] **Step 4: Test workspace separation**

Add `backend/tests/test_production_onboarding.py`:

```python
def test_demo_and_production_workspace_ids_are_distinct() -> None:
    assert DEFAULT_WORKSPACE_ID == 1
```

Add service-level tests using monkeypatched KiotViet client to assert production products are cached under the authenticated workspace id, not `DEFAULT_WORKSPACE_ID`.

- [x] **Step 5: Run tests**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_production_onboarding.py tests/test_agent_scenarios.py tests/test_order_confirmation_flow.py -q
```

Expected:

```text
all tests pass
```

### Task 5: Production GHN Routes and Status

**Files:**
- Modify: `backend/app/shipments/router.py`
- Optionally create: `backend/app/integrations/ghn/router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_production_onboarding.py`

- [x] **Step 1: Add GHN production routes**

Prefer a new router for clarity:

Create `backend/app/integrations/ghn/router.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_workspace
from app.database import get_db
from app.integrations.ghn.schemas import GHNConnectionResponse, GHNPreviewRequest
from app.integrations.ghn.service import authorize_ghn_shop, preview_ghn_shop
from app.models import Workspace

router = APIRouter(prefix="/api/integrations/ghn", tags=["ghn"])


@router.post("/preview", response_model=GHNConnectionResponse)
def preview(payload: GHNPreviewRequest, _: Workspace = Depends(get_current_workspace)) -> GHNConnectionResponse:
    try:
        return preview_ghn_shop(payload.shop_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/authorize", response_model=GHNConnectionResponse)
def authorize(
    payload: GHNPreviewRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> GHNConnectionResponse:
    try:
        return authorize_ghn_shop(db, workspace, payload.shop_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [x] **Step 2: Include router**

Modify `backend/app/main.py`:

```python
from app.integrations.ghn.router import router as ghn_router

app.include_router(ghn_router)
```

- [x] **Step 3: Keep `/api/shipments/status` demo-compatible**

Current endpoint can remain public for demo. Add an authenticated production status endpoint if needed:

```http
GET /api/integrations/ghn/status
```

Response:

```json
{
  "provider": "GHN",
  "status": "connected",
  "env": "sandbox",
  "shop_id": "200457",
  "from_name": "Lumi Beauty",
  "from_phone": "0878359003",
  "from_address": "..."
}
```

- [x] **Step 4: Test**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_production_onboarding.py tests/test_ghn_shipping.py -q
```

Expected:

```text
all tests pass
```

### Task 6: Frontend Auth Screens

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Optionally create: `frontend/src/app/api.ts`
- Test: `frontend build`

- [x] **Step 1: Add auth state**

In `App.tsx`:

```ts
type AuthUser = { id: number; name: string; email: string };
type AuthWorkspace = { id: number; name: string; onboarding_status: 'needs_kiotviet' | 'needs_ghn' | 'ready' };
type AuthSession = { access_token: string; token_type: 'bearer'; user: AuthUser; workspace: AuthWorkspace };

const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
  const raw = window.localStorage.getItem('agentify_auth_session');
  return raw ? JSON.parse(raw) : null;
});
```

- [x] **Step 2: Add authenticated request helper**

```ts
async function authRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}
```

- [x] **Step 3: Add login/register screens**

Add `AuthScreen` component with mode:

```tsx
function AuthScreen({ mode, onSubmit, onSwitch }: {
  mode: 'login' | 'register';
  onSubmit: (payload: any) => void;
  onSwitch: () => void;
}) {
  // Use compact shop-focused form.
  // Register fields: name, shop_name, email, password.
  // Login fields: email, password.
}
```

Behavior:

- On successful register/login:
  - Store session in localStorage.
  - If `workspace.onboarding_status === 'needs_kiotviet'`, set mode `prod-kiotviet-form`.
  - If `needs_ghn`, set mode `prod-ghn-form`.
  - If `ready`, set mode `manage`.

- [x] **Step 4: Build**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
✓ built
```

### Task 7: Frontend Production KiotViet Onboarding

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Use: `frontend/public/guide/kiotviet/video_huong_dan_lay_connect_kiotviet.mp4`

- [x] **Step 1: Add KiotViet form state**

```ts
type KiotVietCredentialForm = {
  retailer: string;
  client_id: string;
  client_secret: string;
};

type KiotVietPreview = {
  status: string;
  retailer: string;
  detected_shop_name: string;
  sample_product_count: number;
};
```

- [x] **Step 2: Add credential form screen**

Component requirements:

- Title: `Kết nối KiotViet`
- Fields:
  - `Tên shop`
  - `Mã khách hàng`
  - `Mã bí mật`
- Video panel:

```tsx
<video controls className="w-full rounded-xl border border-slate-200">
  <source src="/guide/kiotviet/video_huong_dan_lay_connect_kiotviet.mp4" type="video/mp4" />
</video>
```

- Primary button: `Kiểm tra thông tin`
- On submit:

```ts
const preview = await authRequest<KiotVietPreview>('/api/integrations/kiotviet/preview', authSession.access_token, {
  method: 'POST',
  body: JSON.stringify(kiotvietForm),
});
setKiotvietPreview(preview);
setAppMode('prod-kiotviet-authorize');
```

- [x] **Step 3: Reuse authorize-style screen**

The current `KiotVietConnectScreen` should be split or parameterized:

- Demo connection screen can use `.env`.
- Production authorize screen uses `kiotvietPreview` and `kiotvietForm`.

Primary button:

```ts
const result = await authRequest<KiotVietAuthorizeResponse>('/api/integrations/kiotviet/authorize', authSession.access_token, {
  method: 'POST',
  body: JSON.stringify(kiotvietForm),
});
setAppMode('prod-ghn-form');
```

- [x] **Step 4: Build**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
✓ built
```

### Task 8: Frontend Production GHN Onboarding

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Use: `frontend/public/guide/ghn/video_huong_dan_connect_ghn.mp4`

- [x] **Step 1: Add GHN form state**

```ts
type GHNCredentialForm = {
  shop_id: string;
};

type GHNPreview = {
  status: string;
  env: string;
  shop_id: string;
  from_name?: string | null;
  from_phone?: string | null;
  from_address?: string | null;
};
```

- [x] **Step 2: Add GHN credential form**

Fields:

- `Mã khách hàng GHN`

Guide video:

```tsx
<video controls className="w-full rounded-xl border border-slate-200">
  <source src="/guide/ghn/video_huong_dan_connect_ghn.mp4" type="video/mp4" />
</video>
```

Submit:

```ts
const preview = await authRequest<GHNPreview>('/api/integrations/ghn/preview', authSession.access_token, {
  method: 'POST',
  body: JSON.stringify(ghnForm),
});
setGhnPreview(preview);
setAppMode('prod-ghn-authorize');
```

- [x] **Step 3: Add authorize screen**

Show:

- Agentify logo.
- GHN logo text/mark.
- Shop ID.
- Warehouse name/address detected from backend.
- Permissions:
  - Tạo vận đơn.
  - Gửi thông tin khách hàng/địa chỉ/sản phẩm.
  - Theo dõi trạng thái giao hàng.

Primary:

```ts
const result = await authRequest<GHNPreview>('/api/integrations/ghn/authorize', authSession.access_token, {
  method: 'POST',
  body: JSON.stringify(ghnForm),
});
setAppMode('prod-onboarding-success');
```

- [x] **Step 4: Success screen**

Content:

- `Kết nối hoàn tất`
- `Agentify đã sẵn sàng đồng bộ KiotViet và gửi vận đơn GHN cho shop.`
- Button: `Vào giao diện quản lý`

Click:

```ts
setAppMode('manage');
```

- [x] **Step 5: Build**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
✓ built
```

### Task 9: Landing Page Routing

**Files:**
- Modify: `frontend/src/app/components/LandingPage.tsx`
- Modify: `frontend/src/app/App.tsx`

- [x] **Step 1: Ensure `Chat thử` bypasses auth**

In landing props, make chat CTA call:

```ts
onEnterChat={() => navigateTo('/user_chat')}
```

or:

```ts
onEnterChat={() => navigateTo('/demo_chat')}
```

The target screen must call existing public demo chat endpoint.

- [x] **Step 2: Ensure shop CTA requires auth**

Add prop:

```ts
onEnterShop={() => {
  if (authSession) {
    routeFromOnboardingStatus(authSession.workspace.onboarding_status);
  } else {
    setAppMode('auth-login');
  }
}}
```

- [x] **Step 3: Keep old "choose interface" page only if useful**

If current initial page has `Giao diện shop` / `Giao diện chat`, replace it with production landing CTAs:

- `Chat thử`
- `Đăng nhập cho shop`
- `Đăng ký shop`

Do not force demo chat users through shop onboarding.

- [x] **Step 4: Build**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
✓ built
```

### Task 10: Workspace-Aware Dashboard Data

**Files:**
- Modify: `backend/app/chat/router.py`
- Modify: `backend/app/orders/router.py`
- Modify: `backend/app/shipments/router.py`
- Modify: `frontend/src/app/App.tsx`
- Test: backend route tests

- [x] **Step 1: Protect management APIs**

For production management endpoints:

- Use `get_current_workspace()`.
- Filter DB queries by `workspace.id`.

Examples:

```python
@router.get("/conversations", response_model=list[ConversationResponse])
def conversations(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    rows = list_conversations(db, workspace_id=workspace.id)
    ...
```

- [x] **Step 2: Keep demo chat public**

Routes used by `/user_chat` remain public and explicitly use `DEFAULT_WORKSPACE_ID`.

- [x] **Step 3: Update frontend management calls**

All dashboard API calls use `authRequest` after login:

```ts
const rows = await authRequest<Conversation[]>('/api/conversations', authSession.access_token);
```

- [x] **Step 4: Test separation**

Create test:

```python
def test_management_requires_auth() -> None:
    # use TestClient after app wiring
    response = client.get("/api/conversations")
    assert response.status_code == 401
```

And test demo route still works without auth.

### Task 11: End-to-End Verification

**Files:**
- No code if prior tasks pass.

- [x] **Step 1: Backend tests**

Run:

```bash
cd backend && env AZURE_API_KEY=false LLM_API_KEY= GHN_TOKEN= GHN_SHOP_ID= .venv/bin/python -m pytest -q
```

Expected:

```text
all tests pass
```

- [x] **Step 2: Frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected:

```text
✓ built
```

- [x] **Step 3: Rebuild production stack**

Run:

```bash
cd backend && docker compose up -d --build
```

Expected:

```text
agentify-api is running
```

- [x] **Step 4: API smoke**

Run:

```bash
curl -sS http://127.0.0.1:8763/health
curl -sS http://127.0.0.1:8763/api/shipments/status
```

Expected:

```json
{"status":"ok"}
```

and GHN demo status still reports connected when `.env` has GHN credentials.

- [x] **Step 5: Manual browser test**

Test these flows:

1. Landing -> `Chat thử` -> chat opens with no login.
2. In chat, send `Shop ơi tư vấn kem chống nắng với`.
3. Agent consults products without asking login.
4. Landing -> `Đăng ký shop`.
5. Register.
6. KiotViet credential form appears with guide video.
7. Submit valid KiotViet credentials.
8. Authorize KiotViet appears.
9. Click connect.
10. GHN credential form appears with guide video.
11. Submit GHN shop ID.
12. Authorize GHN appears.
13. Click connect.
14. Success appears.
15. Dashboard opens.

---

## Risks and Decisions

- **Auth token implementation:** For MVP, HMAC signed tokens are enough. If this becomes public production, replace with `python-jose` JWT or managed auth.
- **Email validation:** `pydantic.EmailStr` needs `email-validator`. For fastest path, use `str` plus simple `@` validation unless adding dependency is acceptable.
- **GHN credential model:** User asked only for `Mã khách hàng GHN`. Current implementation assumes server-level `GHN_TOKEN` in `.env` plus per-shop `shop_id`. If GHN requires each user to provide their own token, add `token` field to the same form later.
- **No migrations:** Current app uses `Base.metadata.create_all()`. For MVP this is okay. For real production, add Alembic migration scripts.
- **Current `App.tsx` size:** It is already large. If implementation becomes brittle, split auth/onboarding components into separate files before adding more JSX.

---

## Acceptance Criteria

- `docker compose up --build` runs one app.
- Landing `Chat thử` works without login and uses `.env` demo integrations.
- Shop owner can register and login.
- Production dashboard requires login.
- Production onboarding requires KiotViet then GHN.
- KiotViet credentials are entered by user, validated by backend, and saved encrypted.
- GHN shop ID is entered by user, validated by backend, and saved for workspace.
- Guide videos are visible in the relevant credential steps.
- Final onboarding success routes to management dashboard.
- Existing agent scenarios and GHN shipping tests still pass.
