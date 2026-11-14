"""User-owned courses, tasks and timetable routes."""
from fastapi import APIRouter, HTTPException
from ..database import db, insert, record, update, validate_course, values
from ..schemas import CourseData, CoursePatch, TaskData, TaskPatch, ScheduleData, SchedulePatch
from ..security import User, utcnow

router = APIRouter()


@router.get('/api/state')
def state(user: User):
    with db() as conn:
        courses = [dict(c) for c in conn.execute('SELECT * FROM courses WHERE user_id=? ORDER BY id DESC', (user['id'],))]
        tasks = [dict(t) for t in conn.execute('SELECT * FROM tasks WHERE user_id=? ORDER BY id DESC', (user['id'],))]
        schedule = [dict(s) for s in conn.execute('SELECT * FROM schedule WHERE user_id=? ORDER BY day,start_time', (user['id'],))]
    return {'user': {'id': user['id'], 'name': user['name'], 'email': user['email']},
            'courses': courses, 'tasks': tasks, 'schedule': schedule}


@router.post('/api/courses', status_code=201)
def add_course(data: CourseData, user: User):
    with db() as conn:
        return insert(conn, 'courses', user['id'], {**values(data), 'created_at': utcnow().isoformat()})


@router.patch('/api/courses/{item_id}')
def edit_course(item_id: int, data: CoursePatch, user: User):
    with db() as conn:
        return update(conn, 'courses', item_id, user['id'], values(data, patch=True))


@router.delete('/api/courses/{item_id}')
def delete_course(item_id: int, user: User):
    with db() as conn:
        record(conn, 'courses', item_id, user['id'])
        conn.execute('DELETE FROM courses WHERE id=? AND user_id=?', (item_id, user['id']))
    return {'ok': True}


@router.post('/api/tasks', status_code=201)
def add_task(data: TaskData, user: User):
    with db() as conn:
        validate_course(conn, user['id'], data.course_id)
        return insert(conn, 'tasks', user['id'], {**values(data), 'created_at': utcnow().isoformat()})


@router.patch('/api/tasks/{item_id}')
def edit_task(item_id: int, data: TaskPatch, user: User):
    with db() as conn:
        payload = values(data, patch=True)
        if 'course_id' in payload:
            validate_course(conn, user['id'], payload['course_id'])
        return update(conn, 'tasks', item_id, user['id'], payload)


@router.delete('/api/tasks/{item_id}')
def delete_task(item_id: int, user: User):
    with db() as conn:
        record(conn, 'tasks', item_id, user['id'])
        conn.execute('DELETE FROM tasks WHERE id=? AND user_id=?', (item_id, user['id']))
    return {'ok': True}


def check_schedule(conn, user_id, payload):
    validate_course(conn, user_id, payload.get('course_id'))
    if payload['end_time'] <= payload['start_time']:
        raise HTTPException(422, 'End time must be later than start time')


@router.post('/api/schedule', status_code=201)
def add_schedule(data: ScheduleData, user: User):
    with db() as conn:
        payload = values(data)
        check_schedule(conn, user['id'], payload)
        return insert(conn, 'schedule', user['id'], payload)


@router.patch('/api/schedule/{item_id}')
def edit_schedule(item_id: int, data: SchedulePatch, user: User):
    with db() as conn:
        old = dict(record(conn, 'schedule', item_id, user['id']))
        payload = values(data, patch=True)
        check_schedule(conn, user['id'], {**old, **payload})
        return update(conn, 'schedule', item_id, user['id'], payload)


@router.delete('/api/schedule/{item_id}')
def delete_schedule(item_id: int, user: User):
    with db() as conn:
        record(conn, 'schedule', item_id, user['id'])
        conn.execute('DELETE FROM schedule WHERE id=? AND user_id=?', (item_id, user['id']))
    return {'ok': True}


