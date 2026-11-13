"""StudentOS — a small, real full-stack student planner.

Run: uvicorn app:app --reload
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('STUDENTOS_DB', str(ROOT / 'studentos.db')))
app = FastAPI(title='StudentOS API', version='1.0.0', docs_url='/api/docs', redoc_url=None)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def today() -> date:
    return date.today()


@contextmanager
def db():
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


setup_db()


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


def email_normalized(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        raise ValueError('Enter a valid email address')
    return value


class AuthData(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def email_clean(cls, value):
        return email_normalized(value)


class RegisterData(AuthData):
    name: str = Field(min_length=2, max_length=70)
    password: str = Field(min_length=8, max_length=128)


class ProfileData(BaseModel):
    name: str = Field(min_length=2, max_length=70)


class CourseData(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=2, max_length=20)
    instructor: str = Field(default='', max_length=100)
    credits: int = Field(default=3, ge=1, le=20)
    grade: float | None = Field(default=None, ge=0, le=100)
    color: Literal['violet', 'cyan', 'peach', 'green', 'pink', 'blue'] = 'violet'


class CoursePatch(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    code: str | None = Field(None, min_length=2, max_length=20)
    instructor: str | None = Field(None, max_length=100)
    credits: int | None = Field(None, ge=1, le=20)
    grade: float | None = Field(None, ge=0, le=100)
    color: Literal['violet', 'cyan', 'peach', 'green', 'pink', 'blue'] | None = None


class TaskData(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    notes: str = Field(default='', max_length=1000)
    due_date: date | None = None
    priority: Literal['low', 'medium', 'high'] = 'medium'
    status: Literal['todo', 'in_progress', 'done'] = 'todo'
    course_id: int | None = None


class TaskPatch(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=160)
    notes: str | None = Field(None, max_length=1000)
    due_date: date | None = None
    priority: Literal['low', 'medium', 'high'] | None = None
    status: Literal['todo', 'in_progress', 'done'] | None = None
    course_id: int | None = None


class ScheduleData(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    course_id: int | None = None
    day: int = Field(ge=0, le=6)  # Monday = 0
    start_time: str
    end_time: str
    location: str = Field(default='', max_length=80)
    type: Literal['Lecture', 'Lab', 'Seminar', 'Other'] = 'Lecture'

    @field_validator('start_time', 'end_time')
    @classmethod
    def valid_time(cls, value):
        if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
            raise ValueError('Time must be HH:MM')
        return value


class SchedulePatch(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=100)
    course_id: int | None = None
    day: int | None = Field(None, ge=0, le=6)
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = Field(None, max_length=80)
    type: Literal['Lecture', 'Lab', 'Seminar', 'Other'] | None = None

    @field_validator('start_time', 'end_time')
    @classmethod
    def valid_time(cls, value):
        if value is not None and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
            raise ValueError('Time must be HH:MM')
        return value


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


@app.post('/api/auth/register', status_code=201)
def register(info: RegisterData):
    with db() as conn:
        try:
            cur = conn.execute('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)',
                               (info.name.strip(), info.email, pwd_hash(info.password), utcnow().isoformat()))
        except sqlite3.IntegrityError:
            raise HTTPException(409, 'This email is already registered')
        token = new_session(conn, cur.lastrowid)
    return {'token': token}


@app.post('/api/auth/login')
def login(info: AuthData):
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE email=?', (info.email,)).fetchone()
        if not user or not pwd_valid(info.password, user['password_hash']):
            raise HTTPException(401, 'Incorrect email or password')
        token = new_session(conn, user['id'])
    return {'token': token}


@app.post('/api/auth/demo')
def demo():
    """Create a distinct, editable, pre-populated local demo account."""
    name = 'Alex Morgan'
    email = f'demo-{uuid.uuid4().hex[:16]}@studentos.local'
    ts = utcnow().isoformat()
    with db() as conn:
        cur = conn.execute('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)',
                           (name, email, pwd_hash(secrets.token_urlsafe(18)), ts))
        user_id = cur.lastrowid
        courses = [
            ('Data Structures', 'CS 201', 'Dr. Carter', 4, 91, 'violet'),
            ('Web Development', 'SE 220', 'Prof. Kim', 3, 87, 'cyan'),
            ('Linear Algebra', 'MATH 120', 'Dr. Patel', 4, 94, 'peach'),
            ('Database Systems', 'CS 230', 'Prof. Wilson', 3, None, 'green'),
        ]
        cids = []
        for name_, code, instructor, credits, grade, color in courses:
            cids.append(insert(conn, 'courses', user_id, dict(name=name_, code=code, instructor=instructor,
                          credits=credits, grade=grade, color=color, created_at=ts))['id'])
        tasks = [
            ('Complete binary trees assignment', 0, 1, 'high', 'in_progress'),
            ('Build responsive landing page', 1, 3, 'high', 'todo'),
            ('Review eigenvectors & eigenvalues', 2, 2, 'medium', 'todo'),
            ('Finish SQL joins practice', 3, 5, 'medium', 'todo'),
            ('Read chapter 6 notes', 0, 7, 'low', 'todo'),
            ('Submit UI wireframes', 1, -1, 'medium', 'done'),
            ('Practice matrix transformations', 2, -2, 'medium', 'done'),
        ]
        for title, ci, offset, priority, state in tasks:
            insert(conn, 'tasks', user_id, dict(title=title, course_id=cids[ci],
                   due_date=(today()+timedelta(days=offset)).isoformat(), priority=priority,
                   status=state, notes='', created_at=ts))
        entries = [
            (0, 0, '09:00', '10:30', 'Room 204', 'Lecture'),
            (1, 0, '11:00', '12:30', 'Lab 3', 'Lab'),
            (2, 1, '09:00', '10:30', 'Room 310', 'Lecture'),
            (3, 1, '14:00', '15:30', 'Lab 2', 'Lab'),
            (0, 2, '11:00', '12:30', 'Room 208', 'Lecture'),
            (2, 3, '13:00', '14:30', 'Room 105', 'Lecture'),
            (3, 4, '10:00', '11:30', 'Room 302', 'Lecture'),
            (1, 4, '14:00', '15:00', 'Lab 5', 'Seminar'),
        ]
        for ci, day_, start, end, location, kind in entries:
            insert(conn, 'schedule', user_id, dict(title=courses[ci][0], course_id=cids[ci],
                   day=day_, start_time=start, end_time=end, location=location, type=kind))
        token = new_session(conn, user_id)
    return {'token': token}


@app.post('/api/auth/logout')
def logout(user: User, authorization: Annotated[str, Header()]):
    with db() as conn:
        conn.execute('DELETE FROM sessions WHERE token_hash=? AND user_id=?',
                     (hashlib.sha256(authorization.removeprefix('Bearer ').strip().encode()).hexdigest(), user['id']))
    return {'ok': True}


@app.get('/api/me')
def me(user: User):
    return {'id': user['id'], 'name': user['name'], 'email': user['email']}


@app.patch('/api/me')
def edit_me(data: ProfileData, user: User):
    with db() as conn:
        conn.execute('UPDATE users SET name=? WHERE id=?', (data.name.strip(), user['id']))
    return {'ok': True}


@app.get('/api/state')
def state(user: User):
    with db() as conn:
        courses = [dict(c) for c in conn.execute('SELECT * FROM courses WHERE user_id=? ORDER BY id DESC', (user['id'],))]
        tasks = [dict(t) for t in conn.execute('SELECT * FROM tasks WHERE user_id=? ORDER BY id DESC', (user['id'],))]
        schedule = [dict(s) for s in conn.execute('SELECT * FROM schedule WHERE user_id=? ORDER BY day,start_time', (user['id'],))]
    return {'user': {'id': user['id'], 'name': user['name'], 'email': user['email']},
            'courses': courses, 'tasks': tasks, 'schedule': schedule}


@app.post('/api/courses', status_code=201)
def add_course(data: CourseData, user: User):
    with db() as conn:
        return insert(conn, 'courses', user['id'], {**values(data), 'created_at': utcnow().isoformat()})


@app.patch('/api/courses/{item_id}')
def edit_course(item_id: int, data: CoursePatch, user: User):
    with db() as conn:
        return update(conn, 'courses', item_id, user['id'], values(data, patch=True))


@app.delete('/api/courses/{item_id}')
def delete_course(item_id: int, user: User):
    with db() as conn:
        record(conn, 'courses', item_id, user['id'])
        conn.execute('DELETE FROM courses WHERE id=? AND user_id=?', (item_id, user['id']))
    return {'ok': True}


@app.post('/api/tasks', status_code=201)
def add_task(data: TaskData, user: User):
    with db() as conn:
        validate_course(conn, user['id'], data.course_id)
        return insert(conn, 'tasks', user['id'], {**values(data), 'created_at': utcnow().isoformat()})


@app.patch('/api/tasks/{item_id}')
def edit_task(item_id: int, data: TaskPatch, user: User):
    with db() as conn:
        payload = values(data, patch=True)
        if 'course_id' in payload:
            validate_course(conn, user['id'], payload['course_id'])
        return update(conn, 'tasks', item_id, user['id'], payload)


@app.delete('/api/tasks/{item_id}')
def delete_task(item_id: int, user: User):
    with db() as conn:
        record(conn, 'tasks', item_id, user['id'])
        conn.execute('DELETE FROM tasks WHERE id=? AND user_id=?', (item_id, user['id']))
    return {'ok': True}


def check_schedule(conn, user_id, payload):
    validate_course(conn, user_id, payload.get('course_id'))
    if payload['end_time'] <= payload['start_time']:
        raise HTTPException(422, 'End time must be later than start time')


@app.post('/api/schedule', status_code=201)
def add_schedule(data: ScheduleData, user: User):
    with db() as conn:
        payload = values(data)
        check_schedule(conn, user['id'], payload)
        return insert(conn, 'schedule', user['id'], payload)


@app.patch('/api/schedule/{item_id}')
def edit_schedule(item_id: int, data: SchedulePatch, user: User):
    with db() as conn:
        old = dict(record(conn, 'schedule', item_id, user['id']))
        payload = values(data, patch=True)
        check_schedule(conn, user['id'], {**old, **payload})
        return update(conn, 'schedule', item_id, user['id'], payload)


@app.delete('/api/schedule/{item_id}')
def delete_schedule(item_id: int, user: User):
    with db() as conn:
        record(conn, 'schedule', item_id, user['id'])
        conn.execute('DELETE FROM schedule WHERE id=? AND user_id=?', (item_id, user['id']))
    return {'ok': True}


@app.get('/api/health')
def health():
    return {'status': 'ok'}


app.mount('/assets', StaticFiles(directory=ROOT/'frontend'), name='assets')


@app.get('/')
def index():
    return FileResponse(ROOT/'frontend'/'index.html')
