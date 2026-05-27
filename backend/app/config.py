from functools import lru_cache
from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://agentify:agentify@localhost:5432/agentify"
    cors_origins: str = "http://localhost:5173"
    secret_key: str = "change-me"
    fernet_key: str = ""
    access_token_expire_minutes: int = 60 * 24
    password_hash_iterations: int = 210_000

    kiotviet_token_url: str = "https://id.kiotviet.vn/connect/token"
    kiotviet_api_base_url: str = "https://public.kiotapi.com"
    kiotviet_retailer: str = ""
    kiotviet_client_id: str = ""
    kiotviet_client_secret: str = ""
    kiotviet_create_real_orders: bool = False
    demo_stock_fallback: int = 0

    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_http_referer: str = "http://localhost:5173"
    llm_app_title: str = "Agentify MVP"
    azure_api_key: bool = False
    azure_api_version: str = "2024-12-01-preview"
    azure_model: str = "gpt-4o-mini"
    azure_endpoint: str = ""
    azure_public_api_key: str = ""
    azure_private_api_key_path: str = ""

    request_timeout_seconds: Annotated[float, Field(gt=0)] = 20.0
    frontend_base_url: str = "http://localhost:5173"
    public_backend_url: str = ""
    render_external_url: str = ""

    # Zalo OA integration
    zalo_app_id: str = ""
    zalo_app_secret: str = ""
    zalo_authorize_url: str = "https://oauth.zaloapp.com/v4/oa/permission"
    zalo_token_url: str = "https://oauth.zaloapp.com/v4/oa/access_token"
    zalo_send_message_url: str = "https://openapi.zalo.me/v3.0/oa/message"
    zalo_redirect_uri: str = ""
    zalo_callback_success_redirect: str = "http://localhost:5173/?zalo_connected=1"
    zalo_callback_error_redirect: str = "http://localhost:5173/?zalo_connected=0"
    zalo_site_verification: str = ""

    # GHN sandbox/production shipping integration
    ghn_env: str = "sandbox"
    ghn_base_url: str = "https://dev-online-gateway.ghn.vn/shiip/public-api"
    ghn_token: str = ""
    ghn_shop_id: str = ""
    ghn_from_name: str = "Lumi Beauty"
    ghn_from_phone: str = ""
    ghn_from_address: str = ""
    ghn_from_district_id: int = 0
    ghn_from_ward_code: str = ""
    ghn_default_to_district_id: int = 0
    ghn_default_to_ward_code: str = ""
    ghn_default_weight_gram: int = 500
    ghn_default_length_cm: int = 20
    ghn_default_width_cm: int = 15
    ghn_default_height_cm: int = 8
    ghn_default_required_note: str = "CHOXEMHANGKHONGTHU"
    ghn_payment_type_id: int = 2
    ghn_service_type_id: int = 2

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql+"):
            return self.database_url
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+psycopg://", 1)
        return self.database_url

    @property
    def backend_base_url(self) -> str:
        return (self.public_backend_url or self.render_external_url).rstrip("/")

    @property
    def effective_zalo_redirect_uri(self) -> str:
        if self.zalo_redirect_uri:
            return self.zalo_redirect_uri
        if self.backend_base_url:
            return f"{self.backend_base_url}/api/channels/zalo/connect/callback"
        return "http://localhost:8763/api/channels/zalo/connect/callback"

    @property
    def ghn_enabled(self) -> bool:
        return bool(self.ghn_token and self.ghn_shop_id)

    @property
    def effective_llm_model(self) -> str:
        return self.azure_model if self.azure_api_key else self.llm_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
