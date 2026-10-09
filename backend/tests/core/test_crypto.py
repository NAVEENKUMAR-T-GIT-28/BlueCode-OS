import base64
import os

import pytest

from app.core.crypto import (
    DecryptionFailed,
    EncryptionNotConfigured,
    decrypt_json,
    encrypt_json,
)

KEY = base64.b64encode(os.urandom(32)).decode()
CFG = {"host": "smtp.example.com", "password": "s3cret!"}


def test_round_trip_and_ciphertext_hides_content():
    blob = encrypt_json(CFG, key_b64=KEY, context="a:smtp")
    assert b"s3cret" not in blob and b"smtp.example" not in blob
    assert decrypt_json(blob, key_b64=KEY, context="a:smtp") == CFG
    assert encrypt_json(CFG, key_b64=KEY, context="a:smtp") != blob  # random nonce


@pytest.mark.parametrize("key,context", [
    (KEY, "b:smtp"),                                   # another tenant
    (KEY, "a:imap"),                                   # another field
    (base64.b64encode(os.urandom(32)).decode(), "a:smtp"),  # another key
])
def test_wrong_owner_or_key_cannot_decrypt(key, context):
    blob = encrypt_json(CFG, key_b64=KEY, context="a:smtp")
    with pytest.raises(DecryptionFailed):
        decrypt_json(blob, key_b64=key, context=context)


def test_tampering_is_detected():
    blob = encrypt_json(CFG, key_b64=KEY, context="a:smtp")
    with pytest.raises(DecryptionFailed):
        decrypt_json(blob[:-1] + bytes([blob[-1] ^ 1]), key_b64=KEY, context="a:smtp")
    with pytest.raises(DecryptionFailed):
        decrypt_json(b"short", key_b64=KEY, context="a:smtp")


@pytest.mark.parametrize("bad", ["", "not-base64!!", base64.b64encode(b"short").decode()])
def test_bad_keys_are_rejected(bad):
    with pytest.raises(EncryptionNotConfigured):
        encrypt_json(CFG, key_b64=bad, context="x")
