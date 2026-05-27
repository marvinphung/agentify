import base64
import hmac
import hashlib
import json
import os
import time
from typing import Any

from cryptography.fernet import Fernet

from app.config import get_settings


def _fernet_key() -> bytes:
    settings = get_settings()
    if settings.fernet_key:
        return settings.fernet_key.encode("utf-8")
    digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(value: str) -> str:
    return Fernet(_fernet_key()).encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    return Fernet(_fernet_key()).decrypt(value.encode("utf-8")).decode("utf-8")


def hash_password(password: str) -> str:
    settings = get_settings()
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        settings.password_hash_iterations,
    )
    return f"pbkdf2_sha256${settings.password_hash_iterations}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_raw, salt_raw, digest_raw = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = base64.urlsafe_b64decode(salt_raw.encode("utf-8"))
        expected = base64.urlsafe_b64decode(digest_raw.encode("utf-8"))
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def _b64_json(data: dict[str, Any]) -> str:
    raw = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _unb64_json(value: str) -> dict[str, Any]:
    padding = "=" * (-len(value) % 4)
    raw = base64.urlsafe_b64decode((value + padding).encode("utf-8"))
    decoded = json.loads(raw.decode("utf-8"))
    if not isinstance(decoded, dict):
        raise ValueError("Token payload must be an object.")
    return decoded


def create_access_token(subject: int) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        "sub": str(subject),
        "iat": now,
        "exp": now + settings.access_token_expire_minutes * 60,
    }
    body = _b64_json(payload)
    signature = hmac.new(settings.secret_key.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
    return f"{body}.{base64.urlsafe_b64encode(signature).decode('utf-8').rstrip('=')}"


def verify_access_token(token: str) -> int | None:
    try:
        body, signature = token.split(".", 1)
        padding = "=" * (-len(signature) % 4)
        expected = hmac.new(settings_key(), body.encode("utf-8"), hashlib.sha256).digest()
        actual = base64.urlsafe_b64decode((signature + padding).encode("utf-8"))
        if not hmac.compare_digest(actual, expected):
            return None
        payload = _unb64_json(body)
        if int(payload.get("exp") or 0) < int(time.time()):
            return None
        return int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        return None


def settings_key() -> bytes:
    return get_settings().secret_key.encode("utf-8")
