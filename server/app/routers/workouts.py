from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Exercise, RoutineItem, SetEntry, User, Workout
from ..schemas import SetOut, WorkoutIn, WorkoutOut, WorkoutSummary
from ..security import current_user
from ..units import distance_unit_for, from_kg, from_meters, to_kg, to_meters

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


def _volume_kg(sets: list[SetEntry]) -> float:
    return sum((s.weight_kg or 0) * (s.reps or 0) for s in sets)


def _set_out(entry: SetEntry, unit: str) -> SetOut:
    dist_unit = distance_unit_for(unit)
    return SetOut(
        id=entry.id,
        exercise_id=entry.exercise_id,
        exercise_name=entry.exercise.name,
        modality=entry.exercise.modality,
        position=entry.position,
        set_number=entry.set_number,
        weight=from_kg(entry.weight_kg, unit),
        reps=entry.reps,
        distance=from_meters(entry.distance_m, dist_unit),
        duration_s=entry.duration_s,
        rpe=entry.rpe,
        notes=entry.notes,
    )


def _workout_out(workout: Workout, unit: str) -> WorkoutOut:
    return WorkoutOut(
        id=workout.id,
        date=workout.date,
        name=workout.name,
        routine_id=workout.routine_id,
        notes=workout.notes,
        sets=[_set_out(s, unit) for s in workout.sets],
        total_volume=round(from_kg(_volume_kg(workout.sets), unit) or 0, 1),
        set_count=len(workout.sets),
    )


def _load(workout_id: int, user: User, db: Session) -> Workout:
    workout = db.scalar(
        select(Workout)
        .where(Workout.id == workout_id, Workout.user_id == user.id)
        .options(selectinload(Workout.sets).selectinload(SetEntry.exercise))
    )
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


def _build_sets(payload: WorkoutIn, user: User, db: Session) -> list[SetEntry]:
    exercise_ids = [s.exercise_id for s in payload.sets]
    if exercise_ids:
        known = set(
            db.scalars(
                select(Exercise.id).where(
                    Exercise.id.in_(exercise_ids),
                    or_(Exercise.user_id.is_(None), Exercise.user_id == user.id),
                )
            )
        )
        missing = set(exercise_ids) - known
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown exercise ids: {sorted(missing)}")

    dist_unit = distance_unit_for(user.unit)
    return [
        SetEntry(
            exercise_id=s.exercise_id,
            position=position,
            set_number=s.set_number,
            weight_kg=to_kg(s.weight, user.unit),
            reps=s.reps,
            distance_m=to_meters(s.distance, dist_unit),
            duration_s=s.duration_s,
            rpe=s.rpe,
            notes=s.notes,
        )
        for position, s in enumerate(payload.sets)
    ]


@router.get("", response_model=list[WorkoutSummary])
def list_workouts(
    start: date_type | None = None,
    end: date_type | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[WorkoutSummary]:
    stmt = (
        select(Workout)
        .where(Workout.user_id == user.id)
        .options(selectinload(Workout.sets).selectinload(SetEntry.exercise))
        .order_by(Workout.date.desc(), Workout.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if start:
        stmt = stmt.where(Workout.date >= start)
    if end:
        stmt = stmt.where(Workout.date <= end)

    summaries = []
    for workout in db.scalars(stmt):
        names: list[str] = []
        for entry in workout.sets:
            if entry.exercise.name not in names:
                names.append(entry.exercise.name)
        summaries.append(
            WorkoutSummary(
                id=workout.id,
                date=workout.date,
                name=workout.name,
                routine_id=workout.routine_id,
                exercise_names=names,
                set_count=len(workout.sets),
                total_volume=round(from_kg(_volume_kg(workout.sets), user.unit) or 0, 1),
            )
        )
    return summaries


@router.get("/prefill", response_model=list[dict])
def prefill(
    routine_id: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Routine template joined with each exercise's most recent logged sets."""
    items: list[tuple[int, int, int | None, str | None]] = []
    if routine_id is not None:
        rows = db.scalars(
            select(RoutineItem)
            .join(RoutineItem.routine)
            .where(RoutineItem.routine_id == routine_id)
            .options(selectinload(RoutineItem.exercise))
            .order_by(RoutineItem.position)
        )
        items = [(r.exercise_id, r.target_sets, r.target_reps, r.notes) for r in rows]

    out = []
    for exercise_id, target_sets, target_reps, notes in items:
        exercise = db.get(Exercise, exercise_id)
        last_workout_id = db.scalar(
            select(Workout.id)
            .join(SetEntry, SetEntry.workout_id == Workout.id)
            .where(Workout.user_id == user.id, SetEntry.exercise_id == exercise_id)
            .order_by(Workout.date.desc(), Workout.id.desc())
            .limit(1)
        )
        last_sets = []
        if last_workout_id:
            entries = db.scalars(
                select(SetEntry)
                .where(SetEntry.workout_id == last_workout_id, SetEntry.exercise_id == exercise_id)
                .options(selectinload(SetEntry.exercise))
                .order_by(SetEntry.set_number)
            )
            last_sets = [_set_out(e, user.unit).model_dump(mode="json") for e in entries]

        out.append(
            {
                "exercise_id": exercise_id,
                "exercise_name": exercise.name if exercise else "Unknown",
                "modality": exercise.modality if exercise else "strength",
                "target_sets": target_sets,
                "target_reps": target_reps,
                "notes": notes,
                "last_sets": last_sets,
            }
        )
    return out


@router.get("/{workout_id}", response_model=WorkoutOut)
def get_workout(
    workout_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> WorkoutOut:
    return _workout_out(_load(workout_id, user, db), user.unit)


@router.post("", response_model=WorkoutOut, status_code=201)
def create_workout(
    payload: WorkoutIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> WorkoutOut:
    workout = Workout(
        user_id=user.id,
        date=payload.date,
        name=payload.name,
        routine_id=payload.routine_id,
        notes=payload.notes,
    )
    workout.sets = _build_sets(payload, user, db)
    db.add(workout)
    db.commit()
    return _workout_out(_load(workout.id, user, db), user.unit)


@router.put("/{workout_id}", response_model=WorkoutOut)
def update_workout(
    workout_id: int,
    payload: WorkoutIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> WorkoutOut:
    workout = _load(workout_id, user, db)
    workout.date = payload.date
    workout.name = payload.name
    workout.routine_id = payload.routine_id
    workout.notes = payload.notes
    workout.sets.clear()
    db.flush()
    workout.sets = _build_sets(payload, user, db)
    db.commit()
    return _workout_out(_load(workout.id, user, db), user.unit)


@router.delete("/{workout_id}", status_code=204)
def delete_workout(
    workout_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> None:
    db.delete(_load(workout_id, user, db))
    db.commit()
