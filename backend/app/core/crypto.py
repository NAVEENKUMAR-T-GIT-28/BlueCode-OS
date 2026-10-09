"""Encryption of secrets at rest (mailbox credentials) with AES-256-GCM.

Each blob is bound to its owner through the AEAD 'associated data' (startup id and field).
A blob copied into another tenant's row, or another column, fails to decrypt.
"""
import base64
import binascii
import json
import os
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionNotConfigured(Exception):
    """APP_ENCRYPTION_KEY is missing or not 32 base64-encoded bytes."""


class DecryptionFailed(Exception):
    """The blob is corrupt, was encrypted with another key, or belongs to another owner."""


def _key(key_b64: str) -> bytes:
    try:
        key = base64.b64decode(key_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise EncryptionNotConfigured("APP_ENCRYPTION_KEY is not valid base64") from exc
    if len(key) != 32:
        raise EncryptionNotConfigured("APP_ENCRYPTION_KEY must decode to exactly 32 bytes")
    return key


def encrypt_json(obj: Any, *, key_b64: str, context: str) -> bytes:
    nonce = os.urandom(12)
    ciphertext = AESGCM(_key(key_b64)).encrypt(
        nonce, json.dumps(obj).encode(), context.encode()
    )
    return nonce + ciphertext


def decrypt_json(blob: bytes, *, key_b64: str, context: str) -> Any:
    blob = bytes(blob)
    if len(blob) < 29:
        raise DecryptionFailed("Encrypted value is too short")
    try:
        plaintext = AESGCM(_key(key_b64)).decrypt(blob[:12], blob[12:], context.encode())
    except InvalidTag as exc:
        raise DecryptionFailed("Could not decrypt value") from exc
    return json.loads(plaintext)


# Convenience wrappers that read the key from settings (imported lazily so this
# module stays importable on its own).
def encrypt_for(startup_id: str, field: str, obj: Any) -> bytes:
    from app.config import get_settings

    return encrypt_json(
        obj, key_b64=get_settings().app_encryption_key, context=f"{startup_id}:{field}"
    )


def decrypt_for(startup_id: str, field: str, blob: bytes) -> Any:
    from app.config import get_settings

    return decrypt_json(
        blob, key_b64=get_settings().app_encryption_key, context=f"{startup_id}:{field}"
    )
