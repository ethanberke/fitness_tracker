from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Exercise, Routine, RoutineItem, User
from ..schemas import RoutineIn, RoutineOut
from ..security import current_user

router = APIRouter(prefix="/api/routines", tags=["routines"])


def _load(routine_id: int, user: User, db: Session) -> Routine:
    routine = db.scalar(
        select(Routine)
        .where(Routine.id == routine_id, Routine.user_id == user.id)
        .options(selectinload(Routine.items).selectinload(RoutineItem.exercise))
    )
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


def _validate_exercise_ids(ids: list[int], user: User, db: Session) -> None:
    if not ids:
        return
    found = set(
        db.scalars(
            select(Exercise.id).where(
                Exercise.id.in_(ids),
                or_(Exercise.user_id.is_(None), Exercise.user_id == user.id),
            )
        )
    )
    missing = set(ids) - found
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown exercise ids: {sorted(missing)}")


@router.get("", response_model=list[RoutineOut])
def list_routines(
    include_archived: bool = False,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Routine]:
    stmt = (
        select(Routine)
        .where(Routine.user_id == user.id)
        .options(selectinload(Routine.items).selectinload(RoutineItem.exercise))
        .order_by(Routine.created_at.desc())
    )
    if not include_archived:
        stmt = stmt.where(Routine.archived.is_(False))
    return list(db.scalars(stmt))


@router.get("/{routine_id}", response_model=RoutineOut)
def get_routine(
    routine_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Routine:
    return _load(routine_id, user, db)


@router.post("", response_model=RoutineOut, status_code=201)
def create_routine(
    payload: RoutineIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Routine:
    _validate_exercise_ids([i.exercise_id for i in payload.items], user, db)
    routine = Routine(user_id=user.id, name=payload.name.strip(), notes=payload.notes)
    routine.items = [
        RoutineItem(
            exercise_id=item.exercise_id,
            position=position,
            target_sets=item.target_sets,
            target_reps=item.target_reps,
            notes=item.notes,
        )
        for position, item in enumerate(payload.items)
    ]
    db.add(routine)
    db.commit()
    return _load(routine.id, user, db)


@router.put("/{routine_id}", response_model=RoutineOut)
def update_routine(
    routine_id: int,
    payload: RoutineIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Routine:
    routine = _load(routine_id, user, db)
    _validate_exercise_ids([i.exercise_id for i in payload.items], user, db)
    routine.name = payload.name.strip()
    routine.notes = payload.notes
    routine.items.clear()
    db.flush()
    routine.items = [
        RoutineItem(
            exercise_id=item.exercise_id,
            position=position,
            target_sets=item.target_sets,
            target_reps=item.target_reps,
            notes=item.notes,
        )
        for position, item in enumerate(payload.items)
    ]
    db.commit()
    return _load(routine.id, user, db)


@router.delete("/{routine_id}", status_code=204)
def delete_routine(
    routine_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> None:
    routine = _load(routine_id, user, db)
    db.delete(routine)
    db.commit()
