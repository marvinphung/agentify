from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from cryptography.fernet import Fernet

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class LLMClientError(Exception):
    pass


def extract_azure_base_endpoint(full_endpoint: str) -> str:
    parsed = urlparse(full_endpoint)
    return f"{parsed.scheme}://{parsed.netloc}"


def decrypt_api_key(public_api_key: str, private_api_key_path: str) -> str | None:
    if not public_api_key or not private_api_key_path:
        return None

    expanded_path = Path(os.path.expandvars(os.path.expanduser(private_api_key_path.strip('"').strip("'"))))
    if not expanded_path.exists() and expanded_path.is_absolute():
        local_secret_path = Path(__file__).resolve().parents[2] / ".secrets" / expanded_path.name
        if local_secret_path.exists():
            expanded_path = local_secret_path
    if not expanded_path.exists():
        logger.warning("Azure private API key file not found: %s", expanded_path)
        return None

    try:
        cipher_suite = Fernet(public_api_key.encode())
        encrypted_data = expanded_path.read_bytes()
        return cipher_suite.decrypt(encrypted_data).decode()
    except Exception as exc:
        logger.error("Failed to decrypt Azure/OpenAI API key: %s", exc)
        return None


def llm_available(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    if settings.azure_api_key:
        return bool(settings.azure_endpoint and settings.azure_public_api_key and settings.azure_private_api_key_path)
    return bool(settings.llm_api_key)


def _is_openai_compatible_endpoint(endpoint: str) -> bool:
    return "/openai/v1" in endpoint.rstrip("/")


def _uses_completion_token_limit(model_name: str) -> bool:
    normalized = model_name.lower()
    return "gpt-5" in normalized or normalized.startswith(("o1", "o3", "o4"))


def _supports_custom_temperature(model_name: str) -> bool:
    return not _uses_completion_token_limit(model_name)


def _resolve_api_key(settings: Settings) -> str | None:
    if settings.azure_api_key:
        return decrypt_api_key(settings.azure_public_api_key, settings.azure_private_api_key_path)
    return settings.llm_api_key


def _request_config(settings: Settings, payload: dict[str, Any]) -> tuple[str, dict[str, str], dict[str, Any]]:
    api_key = _resolve_api_key(settings)
    if not api_key:
        raise LLMClientError("LLM API key is not configured or could not be decrypted")

    headers = {"Content-Type": "application/json"}
    if settings.azure_api_key:
        endpoint = settings.azure_endpoint.rstrip("/")
        if not endpoint:
            raise LLMClientError("AZURE_ENDPOINT is required when AZURE_API_KEY=true")
        if _is_openai_compatible_endpoint(endpoint):
            headers["Authorization"] = f"Bearer {api_key}"
            return f"{endpoint}/chat/completions", headers, payload

        headers["api-key"] = api_key
        azure_payload = dict(payload)
        azure_payload.pop("model", None)
        base_endpoint = extract_azure_base_endpoint(endpoint)
        url = (
            f"{base_endpoint}/openai/deployments/{settings.azure_model}"
            f"/chat/completions?api-version={settings.azure_api_version}"
        )
        return url, headers, azure_payload

    headers.update(
        {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": settings.llm_http_referer,
            "X-OpenRouter-Title": settings.llm_app_title,
        }
    )
    return f"{settings.llm_base_url.rstrip('/')}/chat/completions", headers, payload


async def generate_llm_json(
    system_prompt: str,
    user_payload: dict[str, Any],
    *,
    temperature: float = 0.2,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    model = settings.effective_llm_model
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False, default=str)},
        ],
        "response_format": {"type": "json_object"},
    }
    if _supports_custom_temperature(model):
        payload["temperature"] = temperature

    url, headers, request_payload = _request_config(settings, payload)
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(url, headers=headers, json=request_payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"].get("content")
        if not content:
            raise LLMClientError("LLM returned empty content")
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise LLMClientError("LLM returned non-object JSON")
        return parsed
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise LLMClientError(str(exc)) from exc
