import pytest

from app.config import get_settings


@pytest.fixture(autouse=True)
def isolate_tests_from_local_llm_env(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("AZURE_API_KEY", "false")
    monkeypatch.setenv("AZURE_ENDPOINT", "")
    monkeypatch.setenv("AZURE_PUBLIC_API_KEY", "")
    monkeypatch.setenv("AZURE_PRIVATE_API_KEY_PATH", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
