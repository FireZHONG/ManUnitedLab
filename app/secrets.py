import ctypes
import os
from ctypes import wintypes

from app import storage

PROVIDERS = {'openai': 'FC_OPENAI_API_KEY', 'deepseek': 'FC_DEEPSEEK_API_KEY'}


class DataBlob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def crypt(value, decrypt=False):
    if os.name != 'nt':
        raise ValueError('本机密钥管理仅支持 Windows。')
    data = ctypes.create_string_buffer(value, len(value))
    source = DataBlob(len(value), ctypes.cast(data, ctypes.POINTER(ctypes.c_ubyte)))
    result = DataBlob()
    crypt32 = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
    kernel32.LocalFree.restype = wintypes.HLOCAL
    if decrypt:
        operation = crypt32.CryptUnprotectData
        operation.argtypes = [ctypes.POINTER(DataBlob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
    else:
        operation = crypt32.CryptProtectData
        operation.argtypes = [ctypes.POINTER(DataBlob), wintypes.LPCWSTR, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
    operation.restype = wintypes.BOOL
    if not operation(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)):
        raise ValueError('无法使用当前 Windows 账户保护或读取密钥，请在本机重新设置。')
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        kernel32.LocalFree(ctypes.cast(result.data, wintypes.HLOCAL))


def provider_key(provider):
    if not isinstance(provider, str) or provider not in PROVIDERS:
        raise ValueError('不支持的密钥服务。')
    return PROVIDERS[provider]


def status(provider):
    env_key = provider_key(provider)
    with storage.connect() as connection:
        local = connection.execute('SELECT 1 FROM secrets WHERE provider = ?', (provider,)).fetchone() is not None
    environment = bool(os.environ.get(env_key, '').strip())
    return {'local': local, 'environment': environment, 'source': 'local' if local else 'environment' if environment else 'none'}


def get(provider):
    env_key = provider_key(provider)
    with storage.connect() as connection:
        row = connection.execute('SELECT ciphertext FROM secrets WHERE provider = ?', (provider,)).fetchone()
    if row:
        try:
            return crypt(row[0], decrypt=True).decode('utf-8')
        except (UnicodeDecodeError, TypeError):
            raise ValueError('本机密钥无法读取，请重新设置。') from None
    return os.environ.get(env_key, '').strip()


def save(provider, value):
    provider_key(provider)
    if not isinstance(value, str):
        raise ValueError('请输入有效的 API Key。')
    value = value.strip()
    if not value or len(value) > 512 or any(ord(character) < 33 or ord(character) == 127 for character in value):
        raise ValueError('API Key 格式无效，请检查是否含空格或换行。')
    encrypted = crypt(value.encode('utf-8'))
    with storage.connect() as connection:
        connection.execute('INSERT OR REPLACE INTO secrets (provider, ciphertext) VALUES (?, ?)', (provider, encrypted))
    return status(provider)


def delete(provider):
    provider_key(provider)
    with storage.connect() as connection:
        connection.execute('DELETE FROM secrets WHERE provider = ?', (provider,))
    return status(provider)
