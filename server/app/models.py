from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    unit: Mapped[str] = mapped_column(String(4), default="lb")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    workouts: Mapped[list["Workout"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    routines: Mapped[list["Routine"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Exercise(Base):
    """Built-in exercises have user_id NULL and are visible to everyone."""

    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    modality: Mapped[str] = mapped_column(String(16), default="strength")  # strength|bodyweight|cardio
    muscle_group: Mapped[str | None] = mapped_column(String(40), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("name", "user_id", name="uq_exercise_name_per_user"),)


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship(back_populates="routines")
    items: Mapped[list["RoutineItem"]] = relationship(
        back_populates="routine", cascade="all, delete-orphan", order_by="RoutineItem.position"
    )


class RoutineItem(Base):
    __tablename__ = "routine_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    target_sets: Mapped[int] = mapped_column(Integer, default=3)
    target_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(200), nullable=True)

    routine: Mapped[Routine] = relationship(back_populates="items")
    exercise: Mapped[Exercise] = relationship()


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    routine_id: Mapped[int | None] = mapped_column(ForeignKey("routines.id", ondelete="SET NULL"), nullable=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship(back_populates="workouts")
    routine: Mapped[Routine | None] = relationship()
    sets: Mapped[list["SetEntry"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", order_by="SetEntry.id"
    )


class SetEntry(Base):
    """One logged set. Canonical storage: kilograms, meters, seconds."""

    __tablename__ = "set_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    set_number: Mapped[int] = mapped_column(Integer, default=1)

    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rpe: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(200), nullable=True)

    workout: Mapped[Workout] = relationship(back_populates="sets")
    exercise: Mapped[Exercise] = relationship()
