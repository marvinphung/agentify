from cryptography.fernet import Fernet

from app.agent.llm_client import decrypt_api_key, extract_azure_base_endpoint, llm_available
from app.config import Settings


def test_decrypt_api_key_from_fernet_file(tmp_path):
    public_key = Fernet.generate_key()
    private_key_path = tmp_path / "azure_private_api_key.enc"
    private_key_path.write_bytes(Fernet(public_key).encrypt(b"sk-test-secret"))

    assert decrypt_api_key(public_key.decode(), str(private_key_path)) == "sk-test-secret"


def test_llm_available_prefers_azure_config_without_plaintext_key():
    settings = Settings(
        azure_api_key=True,
        azure_endpoint="https://example.openai.azure.com",
        azure_public_api_key="public",
        azure_private_api_key_path="/tmp/private.enc",
        llm_api_key="",
    )

    assert llm_available(settings)


def test_extract_azure_base_endpoint_strips_project_path():
    assert (
        extract_azure_base_endpoint("https://aipad.services.ai.azure.com/api/projects/demo/openai/v1/")
        == "https://aipad.services.ai.azure.com"
    )
