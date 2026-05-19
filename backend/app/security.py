import base64
import hashlib

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

