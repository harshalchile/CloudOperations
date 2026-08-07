import base64
import os
from cryptography.fernet import Fernet
from flask import current_app

def get_fernet_cipher():
    key = current_app.config.get('FERNET_KEY')
    if not key or len(key) != 44:
        # Generate a deterministic 32-byte urlsafe key if default is missing/invalid
        raw_key = b"cloudops_fernet_secret_key_32b!"
        key = base64.urlsafe_b64encode(raw_key).decode('utf-8')
    return Fernet(key.encode('utf-8'))

def encrypt_credential(plain_text: str) -> str:
    if not plain_text:
        return ""
    cipher = get_fernet_cipher()
    encrypted_bytes = cipher.encrypt(plain_text.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_credential(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    cipher = get_fernet_cipher()
    decrypted_bytes = cipher.decrypt(cipher_text.encode('utf-8'))
    return decrypted_bytes.decode('utf-8')
