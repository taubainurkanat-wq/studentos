"""Registration, login, demo workspaces and profile endpoints."""
import hashlib
import secrets
import sqlite3
import uuid
from datetime import date, timedelta
from typing import Annotated
from fastapi import APIRouter, Header, HTTPException
from ..config import public_demo
from ..database import db, insert
from ..schemas import AuthData, RegisterData, ProfileData
from ..security import User, new_session, pwd_hash, pwd_valid, utcnow

router = APIRouter()


def today() -> date:
    return date.today()


@router.post('/api/auth/register', status_code=201)
def register(info: RegisterData):
    if public_demo():
        raise HTTPException(403, 'Registration is disabled in the public demo. Try Explore demo workspace.')
    with db() as conn:
        try:
            cur = conn.execute('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)',
                               (info.name.strip(), info.email, pwd_hash(info.password), utcnow().isoformat()))
        except sqlite3.IntegrityError:
            raise HTTPException(409, 'This email is already registered')
        token = new_session(conn, cur.lastrowid)
    return {'token': token}


@router.post('/api/auth/login')
def login(info: AuthData):
    if public_demo():
        raise HTTPException(403, 'Sign-in is disabled in the public demo. Try Explore demo workspace.')
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE email=?', (info.email,)).fetchone()
        if not user or not pwd_valid(info.password, user['password_hash']):
            raise HTTPException(401, 'Incorrect email or password')
        token = new_session(conn, user['id'])
    return {'token': token}


@router.post('/api/auth/demo')
def demo():
    """Create a distinct, editable, pre-populated local demo account."""
    name = 'Alex Morgan'
    email = f'demo-{uuid.uuid4().hex[:16]}@studentos.local'
    ts = utcnow().isoformat()
    with db() as conn:
        if public_demo():
            # Keep ephemeral accounts bounded, and delete their dependent records via foreign keys.
            oldest = (utcnow() - timedelta(hours=1)).isoformat()
            conn.execute('DELETE FROM users WHERE email LIKE ? AND created_at < ?',
                         ('demo-%@studentos.local', oldest))
            active = conn.execute('SELECT count(*) FROM users WHERE email LIKE ?',
                                  ('demo-%@studentos.local',)).fetchone()[0]
            if active >= 120:
                raise HTTPException(429, 'Demo is busy. Please try again later.')
        demo_password = 'DEMO_LOGIN_DISABLED' if public_demo() else pwd_hash(secrets.token_urlsafe(18))
        cur = conn.execute('INSERT INTO users(name,email,password_hash,created_at) VALUES (?,?,?,?)',
                           (name, email, demo_password, ts))
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


@router.post('/api/auth/logout')
def logout(user: User, authorization: Annotated[str, Header()]):
    with db() as conn:
        conn.execute('DELETE FROM sessions WHERE token_hash=? AND user_id=?',
                     (hashlib.sha256(authorization.removeprefix('Bearer ').strip().encode()).hexdigest(), user['id']))
    return {'ok': True}


@router.get('/api/me')
def me(user: User):
    return {'id': user['id'], 'name': user['name'], 'email': user['email']}


@router.patch('/api/me')
def edit_me(data: ProfileData, user: User):
    with db() as conn:
        conn.execute('UPDATE users SET name=? WHERE id=?', (data.name.strip(), user['id']))
    return {'ok': True}


