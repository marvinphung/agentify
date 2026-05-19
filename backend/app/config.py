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

    kiotviet_token_url: str = "https://id.kiotviet.vn/connect/token"
    kiotviet_api_base_url: str = "https://public.kiotapi.com"
    kiotviet_create_real_orders: bool = False

    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_http_referer: str = "http://localhost:5173"
    llm_app_title: str = "Agentify MVP"

    request_timeout_seconds: Annotated[float, Field(gt=0)] = 20.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
