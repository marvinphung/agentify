from pydantic import BaseModel, Field


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


class AuthMeResponse(BaseModel):
    user: UserResponse
    workspace: WorkspaceResponse


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    shop_name: str = Field(min_length=2, max_length=255)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=255)
