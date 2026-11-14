"""SQLite connections, schema and ownership-aware record operations."""
import sqlite3
from contextlib import contextmanager
from datetime import date
from fastapi import HTTPException
from pydantic import BaseModel
from .config import database_path

@contextmanager
def db():
    DB_PATH = database_path()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def setup_db():
    with db() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS courses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL, code TEXT NOT NULL, instructor TEXT NOT NULL DEFAULT '',
          credits INTEGER NOT NULL DEFAULT 3,
          grade REAL, color TEXT NOT NULL DEFAULT 'violet',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
          title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
          due_date TEXT, priority TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'todo',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schedule (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
          title TEXT NOT NULL, day INTEGER NOT NULL,
          start_time TEXT NOT NULL, end_time TEXT NOT NULL,
          location TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'Lecture'
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_user_day ON schedule(user_id, day);
        ''')


def record(conn, table, record_id, user_id):
    obj = conn.execute(f'SELECT * FROM {table} WHERE id=? AND user_id=?', (record_id, user_id)).fetchone()
    if not obj:
        raise HTTPException(404, 'Item not found')
    return obj


def validate_course(conn, user_id, course_id):
    if course_id is not None:
        record(conn, 'courses', course_id, user_id)


def values(model: BaseModel, *, patch=False) -> dict:
    payload = model.model_dump(exclude_unset=patch)
    for key, value in payload.items():
        if isinstance(value, date):
            payload[key] = value.isoformat()
    return payload


def update(conn, table, record_id, user_id, data: dict):
    record(conn, table, record_id, user_id)
    if data:
        sets = ', '.join(f'{k}=?' for k in data)
        conn.execute(f'UPDATE {table} SET {sets} WHERE id=? AND user_id=?',
                     (*data.values(), record_id, user_id))
    return dict(record(conn, table, record_id, user_id))


def insert(conn, table, user_id, data):
    data = {'user_id': user_id, **data}
    fields = ','.join(data.keys())
    placeholders = ','.join('?' for _ in data)
    cur = conn.execute(f'INSERT INTO {table} ({fields}) VALUES ({placeholders})', tuple(data.values()))
    return dict(record(conn, table, cur.lastrowid, user_id))


