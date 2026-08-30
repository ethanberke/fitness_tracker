from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Exercise, SetEntry, User
from ..schemas import ExerciseCreate, ExerciseOut
from ..security import current_user

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def visible_exercises(user_id: int):
    return select(Exercise).where(or_(Exercise.user_id.is_(None), Exercise.user_id == user_id))


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    include_archived: bool = False,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Exercise]:
    stmt = visible_exercises(user.id)
    if not include_archived:
        stmt = stmt.where(Exercise.archived.is_(False))
    return list(db.scalars(stmt.order_by(Exercise.name)))


@router.post("", response_model=ExerciseOut, status_code=201)
def create_exercise(
    payload: ExerciseCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Exercise:
    name = payload.name.strip()
    existing = db.scalar(visible_exercises(user.id).where(Exercise.name.ilike(name)))
    if existing:
        raise HTTPException(status_code=409, detail=f"'{existing.name}' already exists")

    exercise = Exercise(
        name=name,
        modality=payload.modality,
        muscle_group=payload.muscle_group,
        user_id=user.id,
    )
    db.add(exercise)
    db.commit()
    return exercise


def _owned_custom_exercise(exercise_id: int, user: User, db: Session) -> Exercise:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None or (exercise.user_id not in (None, user.id)):
        raise HTTPException(status_code=404, detail="Exercise not found")
    if exercise.user_id is None:
        raise HTTPException(status_code=403, detail="Built-in exercises can't be modified")
    return exercise


@router.patch("/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    exercise_id: int,
    payload: ExerciseCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Exercise:
    exercise = _owned_custom_exercise(exercise_id, user, db)
    exercise.name = payload.name.strip()
    exercise.modality = payload.modality
    exercise.muscle_group = payload.muscle_group
    db.commit()
    return exercise


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> None:
    exercise = _owned_custom_exercise(exercise_id, user, db)
    in_use = db.scalar(select(SetEntry.id).where(SetEntry.exercise_id == exercise.id).limit(1))
    if in_use:
        # Keep the history intact; hide it from pickers instead.
        exercise.archived = True
    else:
        db.delete(exercise)
    db.commit()
