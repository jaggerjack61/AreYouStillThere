from cryptography.fernet import Fernet
from django.conf import settings


def get_encryption_key():
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    if not key:
        key = Fernet.generate_key().decode()
    return key.encode() if isinstance(key, str) else key


def encrypt_value(plain_text):
    if not plain_text:
        return ''
    fernet = Fernet(get_encryption_key())
    return fernet.encrypt(plain_text.encode()).decode()


def decrypt_value(encrypted_text):
    if not encrypted_text:
        return ''
    fernet = Fernet(get_encryption_key())
    return fernet.decrypt(encrypted_text.encode()).decode()
