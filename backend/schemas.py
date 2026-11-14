"""Request validation models for authentication and workspace records."""
import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, field_validator

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


