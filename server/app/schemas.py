from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Modality = Literal["strength", "bodyweight", "cardio"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth ---------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    unit: Literal["lb", "kg"] = "lb"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    email: EmailStr
    display_name: str
    unit: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    unit: Literal["lb", "kg"] | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


# --- exercises ----------------------------------------------------------


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    modality: Modality = "strength"
    muscle_group: str | None = Field(default=None, max_length=40)


class ExerciseOut(ORMModel):
    id: int
    name: str
    modality: str
    muscle_group: str | None
    user_id: int | None
    archived: bool


# --- routines -----------------------------------------------------------


class RoutineItemIn(BaseModel):
    exercise_id: int
    target_sets: int = Field(default=3, ge=1, le=20)
    target_reps: int | None = Field(default=None, ge=1, le=200)
    notes: str | None = Field(default=None, max_length=200)


class RoutineItemOut(ORMModel):
    id: int
    exercise_id: int
    position: int
    target_sets: int
    target_reps: int | None
    notes: str | None
    exercise: ExerciseOut


class RoutineIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    notes: str | None = None
    items: list[RoutineItemIn] = []


class RoutineOut(ORMModel):
    id: int
    name: str
    notes: str | None
    archived: bool
    items: list[RoutineItemOut]


# --- workouts -----------------------------------------------------------


class SetIn(BaseModel):
    exercise_id: int
    set_number: int = Field(default=1, ge=1, le=99)
    weight: float | None = Field(default=None, ge=0, le=2000)
    reps: int | None = Field(default=None, ge=0, le=1000)
    distance: float | None = Field(default=None, ge=0, le=1000)
    duration_s: int | None = Field(default=None, ge=0, le=86400)
    rpe: float | None = Field(default=None, ge=1, le=10)
    notes: str | None = Field(default=None, max_length=200)


class SetOut(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str
    modality: str
    position: int
    set_number: int
    weight: float | None
    reps: int | None
    distance: float | None
    duration_s: int | None
    rpe: float | None
    notes: str | None


class WorkoutIn(BaseModel):
    date: date_type
    name: str | None = Field(default=None, max_length=120)
    routine_id: int | None = None
    notes: str | None = None
    sets: list[SetIn] = []


class WorkoutOut(BaseModel):
    id: int
    date: date_type
    name: str | None
    routine_id: int | None
    notes: str | None
    sets: list[SetOut]
    total_volume: float
    set_count: int


class WorkoutSummary(BaseModel):
    id: int
    date: date_type
    name: str | None
    routine_id: int | None
    exercise_names: list[str]
    set_count: int
    total_volume: float


# --- progress -----------------------------------------------------------


class SeriesPoint(BaseModel):
    date: date_type
    value: float
    label: str


class ProgressSeries(BaseModel):
    exercise_id: int
    exercise_name: str
    modality: str
    metric: str
    metric_label: str
    unit: str
    points: list[SeriesPoint]
    best: SeriesPoint | None = None
    change_pct: float | None = None
    trend: list[float] = []


class PersonalRecord(BaseModel):
    exercise_id: int
    exercise_name: str
    modality: str
    metric_label: str
    value: float
    unit: str
    label: str
    date: date_type


class VolumePoint(BaseModel):
    week_start: date_type
    volume: float
    sets: int
    workouts: int


class DashboardStats(BaseModel):
    workouts_total: int
    workouts_this_week: int
    sets_this_week: int
    volume_this_week: float
    volume_unit: str
    current_streak_weeks: int
    weekly_volume: list[VolumePoint]
    recent_prs: list[PersonalRecord]
