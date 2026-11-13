"""Run: python -m pytest -q"""
import importlib
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('STUDENTOS_DB', str(tmp_path/'test.db'))
    import app as module
    importlib.reload(module)
    with TestClient(module.app) as c:
        yield c


def signup(client, email='tester@example.com'):
    response = client.post('/api/auth/register', json={
        'name': 'Taylor Student', 'email': email, 'password': 'correct-password-123'})
    assert response.status_code == 201, response.text
    return {'Authorization': 'Bearer ' + response.json()['token']}


def test_auth_and_unique_emails(client):
    headers = signup(client)
    assert client.get('/api/state', headers=headers).status_code == 200
    assert client.get('/api/state').status_code == 401
    assert client.post('/api/auth/register', json={'name': 'Taylor', 'email': 'tester@example.com', 'password': 'test-pass-123'}).status_code == 409
    assert client.post('/api/auth/login', json={'email': 'tester@example.com', 'password': 'wrongpass'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': 'tester@example.com', 'password': 'correct-password-123'}).status_code == 200
    assert client.post('/api/auth/logout', headers=headers).status_code == 200
    assert client.get('/api/state', headers=headers).status_code == 401


def test_course_task_schedule_crud(client):
    h = signup(client)
    cr = client.post('/api/courses', headers=h, json={'name': 'Programming', 'code': 'CS101', 'credits': 4, 'grade': 88})
    assert cr.status_code == 201, cr.text
    cid = cr.json()['id']
    tr = client.post('/api/tasks', headers=h, json={'title': 'Complete lab', 'course_id': cid, 'due_date': '2026-12-20', 'priority': 'high'})
    assert tr.status_code == 201, tr.text
    tid = tr.json()['id']
    assert client.patch(f'/api/tasks/{tid}', headers=h, json={'status': 'done'}).json()['status'] == 'done'
    sr = client.post('/api/schedule', headers=h, json={'title': 'Programming Lab', 'course_id': cid, 'day': 2, 'start_time': '14:00', 'end_time': '15:30'})
    assert sr.status_code == 201, sr.text
    sid = sr.json()['id']
    assert client.patch(f'/api/schedule/{sid}', headers=h, json={'location': 'Room 102'}).json()['location'] == 'Room 102'
    assert client.patch(f'/api/courses/{cid}', headers=h, json={'grade': 95}).json()['grade'] == 95
    assert len(client.get('/api/state', headers=h).json()['courses']) == 1
    assert client.delete(f'/api/courses/{cid}', headers=h).status_code == 200
    state = client.get('/api/state', headers=h).json()
    assert state['tasks'][0]['course_id'] is None
    assert state['schedule'][0]['course_id'] is None
    assert client.delete(f'/api/tasks/{tid}', headers=h).status_code == 200
    assert client.delete(f'/api/schedule/{sid}', headers=h).status_code == 200


def test_users_cannot_access_others_content(client):
    a = signup(client, 'a@example.com')
    b = signup(client, 'b@example.com')
    cid = client.post('/api/courses', headers=a, json={'name':'Mathematics', 'code':'MATH101'}).json()['id']
    assert client.patch(f'/api/courses/{cid}', headers=b, json={'grade':99}).status_code == 404
    assert client.post('/api/tasks', headers=b, json={'title':'Read chapter', 'course_id':cid}).status_code == 404
    assert client.delete(f'/api/courses/{cid}', headers=b).status_code == 404


def test_validation_and_demo(client):
    h = signup(client)
    assert client.post('/api/tasks', headers=h, json={'title':'x'}).status_code == 422
    assert client.post('/api/courses', headers=h, json={'name':'Biology', 'code':'BIO', 'grade':120}).status_code == 422
    assert client.post('/api/schedule', headers=h, json={'title':'Physics', 'day':2, 'start_time':'15:00','end_time':'14:00'}).status_code == 422
    demo = client.post('/api/auth/demo')
    assert demo.status_code == 200
    st = client.get('/api/state', headers={'Authorization': 'Bearer '+demo.json()['token']}).json()
    assert len(st['courses']) == 4
    assert len(st['tasks']) == 7
    assert len(st['schedule']) == 8


def test_frontend_served(client):
    assert client.get('/').status_code == 200
    assert 'StudentOS' in client.get('/').text
    assert client.get('/assets/app.js').status_code == 200
    assert client.get('/api/health').json()['status'] == 'ok'


def test_public_demo_mode(tmp_path, monkeypatch):
    monkeypatch.setenv('STUDENTOS_DB', str(tmp_path/'public.db'))
    monkeypatch.setenv('STUDENTOS_PUBLIC_DEMO', '1')
    import app as module
    importlib.reload(module)
    with TestClient(module.app) as c:
        assert c.get('/api/config').json()['public_demo'] is True
        assert c.post('/api/auth/register', json={
            'name': 'Taylor Student', 'email': 'example@example.com', 'password': 'secure-password-123'
        }).status_code == 403
        assert c.post('/api/auth/login', json={
            'email': 'example@example.com', 'password': 'secure-password-123'
        }).status_code == 403
        response = c.post('/api/auth/demo')
        assert response.status_code == 200, response.text
        headers = {'Authorization': f"Bearer {response.json()['token']}"}
        assert len(c.get('/api/state', headers=headers).json()['courses']) == 4
