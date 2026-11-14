"""Password hashing, session creation and authenticated-user dependency."""
import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import Depends, Header, HTTPException, status
from .database import db

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def pwd_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 260_000)
    return f'{salt.hex()}:{digest.hex()}'


def pwd_valid(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split(':', 1)
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt_hex), 260_000)
        return hmac.compare_digest(actual, bytes.fromhex(digest_hex))
    except (ValueError, TypeError):
        return False


def new_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = (utcnow() + timedelta(days=7)).isoformat()
    conn.execute('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?,?,?)',
                 (hashlib.sha256(token.encode()).hexdigest(), user_id, expires))
    return token


def get_user(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Please sign in first')
    token = authorization.removeprefix('Bearer ').strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid session')
    with db() as conn:
        user = conn.execute('''SELECT u.id,u.name,u.email,s.expires_at FROM users u
            JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=?''',
            (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
        if not user or datetime.fromisoformat(user['expires_at']) <= utcnow():
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Session expired. Sign in again')
    return dict(user)


User = Annotated[dict, Depends(get_user)]


