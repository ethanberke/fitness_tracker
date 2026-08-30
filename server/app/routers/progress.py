from datetime import date as date_type
from datetime import timedelta

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Exercise, SetEntry, User, Workout
from ..schemas import (
    DashboardStats,
    PersonalRecord,
    ProgressSeries,
    SeriesPoint,
    VolumePoint,
)
from ..security import current_user
from ..units import distance_unit_for, from_kg, from_meters

router = APIRouter(prefix="/api/progress", tags=["progress"])

METRICS_BY_MODALITY = {
    "strength": ["est_1rm", "top_weight", "volume", "total_reps"],
    "bodyweight": ["max_reps", "total_reps", "volume"],
    "cardio": ["pace", "distance", "duration", "avg_speed"],
}

METRIC_LABELS = {
    "est_1rm": "Estimated 1RM",
    "top_weight": "Top set weight",
    "volume": "Session volume",
    "total_reps": "Total reps",
    "max_reps": "Best set (reps)",
    "pace": "Pace",
    "distance": "Distance",
    "duration": "Duration",
    "avg_speed": "Average speed",
}

# Pace improves as it falls; every other metric improves as it rises.
LOWER_IS_BETTER = {"pace"}


def _epley(weight: float, reps: int) -> float:
    """Estimated one-rep max. Epley holds up well through ~10 reps."""
    if not weight or not reps:
        return 0.0
    return weight * (1 + reps / 30)


def _load_frame(user: User, db: Session, start: date_type | None, end: date_type | None,
                exercise_id: int | None = None) -> pd.DataFrame:
    stmt = (
        select(SetEntry, Workout.date, Exercise.name, Exercise.modality)
        .join(Workout, SetEntry.workout_id == Workout.id)
        .join(Exercise, SetEntry.exercise_id == Exercise.id)
        .where(Workout.user_id == user.id)
        .options(selectinload(SetEntry.exercise))
    )
    if start:
        stmt = stmt.where(Workout.date >= start)
    if end:
        stmt = stmt.where(Workout.date <= end)
    if exercise_id:
        stmt = stmt.where(SetEntry.exercise_id == exercise_id)

    rows = [
        {
            "date": pd.Timestamp(row.date),
            "exercise_id": row.SetEntry.exercise_id,
            "exercise_name": row.name,
            "modality": row.modality,
            "weight_kg": row.SetEntry.weight_kg or 0.0,
            "reps": row.SetEntry.reps or 0,
            "distance_m": row.SetEntry.distance_m or 0.0,
            "duration_s": row.SetEntry.duration_s or 0,
        }
        for row in db.execute(stmt)
    ]
    columns = ["date", "exercise_id", "exercise_name", "modality", "weight_kg", "reps",
               "distance_m", "duration_s"]
    return pd.DataFrame(rows, columns=columns)


def _format_duration(seconds: float) -> str:
    seconds = int(round(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


@router.get("/exercises", response_model=list[dict])
def logged_exercises(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Exercises this user has actually logged, newest activity first."""
    rows = db.execute(
        select(
            Exercise.id,
            Exercise.name,
            Exercise.modality,
            Workout.date,
        )
        .join(SetEntry, SetEntry.exercise_id == Exercise.id)
        .join(Workout, SetEntry.workout_id == Workout.id)
        .where(Workout.user_id == user.id)
    ).all()

    latest: dict[int, dict] = {}
    for exercise_id, name, modality, workout_date in rows:
        entry = latest.get(exercise_id)
        if entry is None or workout_date > entry["last_logged"]:
            latest[exercise_id] = {
                "id": exercise_id,
                "name": name,
                "modality": modality,
                "last_logged": workout_date,
                "metrics": METRICS_BY_MODALITY[modality],
            }
    return sorted(latest.values(), key=lambda e: e["last_logged"], reverse=True)


@router.get("/series", response_model=ProgressSeries)
def series(
    exercise_id: int,
    metric: str | None = None,
    start: date_type | None = None,
    end: date_type | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ProgressSeries:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None or exercise.user_id not in (None, user.id):
        raise HTTPException(status_code=404, detail="Exercise not found")

    allowed = METRICS_BY_MODALITY[exercise.modality]
    metric = metric or allowed[0]
    if metric not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"'{metric}' is not available for {exercise.modality} exercises; try {allowed}",
        )

    df = _load_frame(user, db, start, end, exercise_id)
    weight_unit = user.unit
    dist_unit = distance_unit_for(weight_unit)

    if df.empty:
        return ProgressSeries(
            exercise_id=exercise_id,
            exercise_name=exercise.name,
            modality=exercise.modality,
            metric=metric,
            metric_label=METRIC_LABELS[metric],
            unit="",
            points=[],
        )

    df["weight"] = df["weight_kg"].apply(lambda kg: from_kg(kg, weight_unit) or 0.0)
    df["distance"] = df["distance_m"].apply(lambda m: from_meters(m, dist_unit) or 0.0)
    df["volume"] = df["weight"] * df["reps"]
    df["est_1rm"] = df.apply(lambda r: _epley(r["weight"], r["reps"]), axis=1)

    grouped = df.groupby("date", as_index=True)
    points: list[SeriesPoint] = []
    unit = ""

    if metric in {"est_1rm", "top_weight"}:
        unit = weight_unit
        for day, chunk in grouped:
            if metric == "est_1rm":
                best_idx = chunk["est_1rm"].idxmax()
                value = float(chunk.loc[best_idx, "est_1rm"])
            else:
                best_idx = chunk["weight"].idxmax()
                value = float(chunk.loc[best_idx, "weight"])
            if value <= 0:
                continue
            best = chunk.loc[best_idx]
            points.append(
                SeriesPoint(
                    date=day.date(),
                    value=round(value, 1),
                    label=f"{best['weight']:g} {weight_unit} × {int(best['reps'])}",
                )
            )
    elif metric == "volume":
        unit = weight_unit
        for day, chunk in grouped:
            value = float(chunk["volume"].sum())
            if value <= 0:
                continue
            points.append(
                SeriesPoint(
                    date=day.date(),
                    value=round(value, 1),
                    label=f"{value:,.0f} {weight_unit} across {len(chunk)} sets",
                )
            )
    elif metric in {"total_reps", "max_reps"}:
        unit = "reps"
        for day, chunk in grouped:
            value = float(chunk["reps"].sum() if metric == "total_reps" else chunk["reps"].max())
            if value <= 0:
                continue
            suffix = f"across {len(chunk)} sets" if metric == "total_reps" else "in one set"
            points.append(
                SeriesPoint(date=day.date(), value=round(value, 1), label=f"{value:g} reps {suffix}")
            )
    elif metric == "distance":
        unit = dist_unit
        for day, chunk in grouped:
            value = float(chunk["distance"].sum())
            if value <= 0:
                continue
            points.append(
                SeriesPoint(date=day.date(), value=round(value, 2), label=f"{value:.2f} {dist_unit}")
            )
    elif metric == "duration":
        unit = "min"
        for day, chunk in grouped:
            seconds = float(chunk["duration_s"].sum())
            if seconds <= 0:
                continue
            points.append(
                SeriesPoint(
                    date=day.date(),
                    value=round(seconds / 60, 2),
                    label=_format_duration(seconds),
                )
            )
    elif metric in {"pace", "avg_speed"}:
        unit = f"min/{dist_unit}" if metric == "pace" else f"{dist_unit}/h"
        for day, chunk in grouped:
            distance = float(chunk["distance"].sum())
            seconds = float(chunk["duration_s"].sum())
            if distance <= 0 or seconds <= 0:
                continue
            if metric == "pace":
                minutes_per_unit = (seconds / 60) / distance
                label = f"{int(minutes_per_unit)}:{int(round((minutes_per_unit % 1) * 60)):02d} /{dist_unit}"
                points.append(SeriesPoint(date=day.date(), value=round(minutes_per_unit, 3), label=label))
            else:
                speed = distance / (seconds / 3600)
                points.append(
                    SeriesPoint(date=day.date(), value=round(speed, 2), label=f"{speed:.2f} {dist_unit}/h")
                )

    points.sort(key=lambda p: p.date)

    best_point = None
    change_pct = None
    trend: list[float] = []
    if points:
        best_point = min(points, key=lambda p: p.value) if metric in LOWER_IS_BETTER else max(
            points, key=lambda p: p.value
        )
        first, last = points[0].value, points[-1].value
        if first:
            raw_change = (last - first) / first * 100
            change_pct = round(-raw_change if metric in LOWER_IS_BETTER else raw_change, 1)
        window = min(3, len(points))
        trend = [
            round(v, 2)
            for v in pd.Series([p.value for p in points]).rolling(window, min_periods=1).mean().tolist()
        ]

    return ProgressSeries(
        exercise_id=exercise_id,
        exercise_name=exercise.name,
        modality=exercise.modality,
        metric=metric,
        metric_label=METRIC_LABELS[metric],
        unit=unit,
        points=points,
        best=best_point,
        change_pct=change_pct,
        trend=trend,
    )


def _personal_records(df: pd.DataFrame, unit: str, limit: int) -> list[PersonalRecord]:
    if df.empty:
        return []

    strength = df[(df["modality"] == "strength") & (df["est_1rm"] > 0)]
    records: list[PersonalRecord] = []
    if not strength.empty:
        for exercise_id, chunk in strength.groupby("exercise_id"):
            best = chunk.loc[chunk["est_1rm"].idxmax()]
            records.append(
                PersonalRecord(
                    exercise_id=int(exercise_id),
                    exercise_name=best["exercise_name"],
                    modality="strength",
                    metric_label="Estimated 1RM",
                    value=round(float(best["est_1rm"]), 1),
                    unit=unit,
                    label=f"{best['weight']:g} {unit} × {int(best['reps'])}",
                    date=best["date"].date(),
                )
            )

    bodyweight = df[(df["modality"] == "bodyweight") & (df["reps"] > 0)]
    if not bodyweight.empty:
        for exercise_id, chunk in bodyweight.groupby("exercise_id"):
            best = chunk.loc[chunk["reps"].idxmax()]
            records.append(
                PersonalRecord(
                    exercise_id=int(exercise_id),
                    exercise_name=best["exercise_name"],
                    modality="bodyweight",
                    metric_label="Best set",
                    value=float(best["reps"]),
                    unit="reps",
                    label=f"{int(best['reps'])} reps",
                    date=best["date"].date(),
                )
            )

    records.sort(key=lambda r: r.date, reverse=True)
    return records[:limit]


@router.get("/prs", response_model=list[PersonalRecord])
def personal_records(
    limit: int = Query(default=25, ge=1, le=200),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[PersonalRecord]:
    df = _load_frame(user, db, None, None)
    if df.empty:
        return []
    df["weight"] = df["weight_kg"].apply(lambda kg: from_kg(kg, user.unit) or 0.0)
    df["est_1rm"] = df.apply(lambda r: _epley(r["weight"], r["reps"]), axis=1)
    return _personal_records(df, user.unit, limit)


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(
    weeks: int = Query(default=12, ge=1, le=104),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> DashboardStats:
    df = _load_frame(user, db, None, None)
    total_count = len(db.scalars(select(Workout.id).where(Workout.user_id == user.id)).all())

    if df.empty:
        return DashboardStats(
            workouts_total=total_count,
            workouts_this_week=0,
            sets_this_week=0,
            volume_this_week=0.0,
            volume_unit=user.unit,
            current_streak_weeks=0,
            weekly_volume=[],
            recent_prs=[],
        )

    df["weight"] = df["weight_kg"].apply(lambda kg: from_kg(kg, user.unit) or 0.0)
    df["volume"] = df["weight"] * df["reps"]
    df["est_1rm"] = df.apply(lambda r: _epley(r["weight"], r["reps"]), axis=1)
    # Monday-anchored weeks, so "this week" matches how a training week is planned.
    df["week_start"] = df["date"] - pd.to_timedelta(df["date"].dt.dayofweek, unit="D")

    weekly = (
        df.groupby("week_start")
        .agg(volume=("volume", "sum"), sets=("volume", "size"), workouts=("date", "nunique"))
        .sort_index()
        .tail(weeks)
    )
    weekly_points = [
        VolumePoint(
            week_start=idx.date(),
            volume=round(float(row["volume"]), 1),
            sets=int(row["sets"]),
            workouts=int(row["workouts"]),
        )
        for idx, row in weekly.iterrows()
    ]

    today = pd.Timestamp(date_type.today())
    this_week_start = today - timedelta(days=int(today.dayofweek))
    this_week = df[df["week_start"] == this_week_start]

    # Consecutive Monday-weeks with at least one workout, counting back from this week.
    logged_weeks = set(weekly.index)
    streak = 0
    cursor = this_week_start
    if cursor not in logged_weeks:
        cursor -= timedelta(days=7)
    while cursor in logged_weeks:
        streak += 1
        cursor -= timedelta(days=7)

    return DashboardStats(
        workouts_total=total_count,
        workouts_this_week=int(this_week["date"].nunique()) if not this_week.empty else 0,
        sets_this_week=int(len(this_week)),
        volume_this_week=round(float(this_week["volume"].sum()), 1) if not this_week.empty else 0.0,
        volume_unit=user.unit,
        current_streak_weeks=streak,
        weekly_volume=weekly_points,
        recent_prs=_personal_records(df, user.unit, 5),
    )


@router.get("/export.csv")
def export_csv(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Every logged set as a flat CSV — for spreadsheets or your own pandas work."""
    from fastapi.responses import StreamingResponse

    df = _load_frame(user, db, None, None)
    dist_unit = distance_unit_for(user.unit)
    if df.empty:
        csv_text = "date,exercise,modality,weight,reps,distance,duration_s\n"
    else:
        df["weight"] = df["weight_kg"].apply(lambda kg: from_kg(kg, user.unit) or 0.0)
        df["distance"] = df["distance_m"].apply(lambda m: from_meters(m, dist_unit) or 0.0)
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        csv_text = df[
            ["date", "exercise_name", "modality", "weight", "reps", "distance", "duration_s"]
        ].to_csv(index=False)

    filename = f"fitness-{date_type.today().isoformat()}.csv"
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
