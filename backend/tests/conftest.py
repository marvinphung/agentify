import pytest

from app.config import get_settings


@pytest.fixture(autouse=True)
def isolate_tests_from_local_llm_env(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("AZURE_API_KEY", "false")
    monkeypatch.setenv("AZURE_ENDPOINT", "")
    monkeypatch.setenv("AZURE_PUBLIC_API_KEY", "")
    monkeypatch.setenv("AZURE_PRIVATE_API_KEY_PATH", "")
    monkeypatch.setenv("GHN_TOKEN", "")
    monkeypatch.setenv("GHN_SHOP_ID", "")
    monkeypatch.setenv("GHN_FROM_PHONE", "")
    monkeypatch.setenv("GHN_FROM_ADDRESS", "")
    monkeypatch.setenv("GHN_FROM_DISTRICT_ID", "0")
    monkeypatch.setenv("GHN_FROM_WARD_CODE", "")
    monkeypatch.setenv("GHN_DEFAULT_TO_DISTRICT_ID", "0")
    monkeypatch.setenv("GHN_DEFAULT_TO_WARD_CODE", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
