from app.config import Settings


def test_render_postgres_url_uses_psycopg_driver() -> None:
    settings = Settings(_env_file=None, database_url="postgres://user:pass@host:5432/agentify")

    assert settings.sqlalchemy_database_url == "postgresql+psycopg://user:pass@host:5432/agentify"


def test_zalo_redirect_uri_can_use_render_external_url() -> None:
    settings = Settings(_env_file=None, render_external_url="https://agentify-api.onrender.com")

    assert settings.effective_zalo_redirect_uri == "https://agentify-api.onrender.com/api/channels/zalo/connect/callback"
