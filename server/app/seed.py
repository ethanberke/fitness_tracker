from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Exercise

BUILT_IN: list[tuple[str, str, str]] = [
    # (name, modality, muscle_group)
    ("Barbell Bench Press", "strength", "Chest"),
    ("Incline Dumbbell Press", "strength", "Chest"),
    ("Dumbbell Fly", "strength", "Chest"),
    ("Cable Crossover", "strength", "Chest"),
    ("Overhead Press", "strength", "Shoulders"),
    ("Dumbbell Shoulder Press", "strength", "Shoulders"),
    ("Lateral Raise", "strength", "Shoulders"),
    ("Face Pull", "strength", "Shoulders"),
    ("Triceps Pushdown", "strength", "Triceps"),
    ("Skullcrusher", "strength", "Triceps"),
    ("Overhead Triceps Extension", "strength", "Triceps"),
    ("Deadlift", "strength", "Back"),
    ("Barbell Row", "strength", "Back"),
    ("Seated Cable Row", "strength", "Back"),
    ("Lat Pulldown", "strength", "Back"),
    ("Dumbbell Row", "strength", "Back"),
    ("Shrug", "strength", "Back"),
    ("Barbell Curl", "strength", "Biceps"),
    ("Dumbbell Curl", "strength", "Biceps"),
    ("Hammer Curl", "strength", "Biceps"),
    ("Preacher Curl", "strength", "Biceps"),
    ("Back Squat", "strength", "Legs"),
    ("Front Squat", "strength", "Legs"),
    ("Leg Press", "strength", "Legs"),
    ("Romanian Deadlift", "strength", "Legs"),
    ("Leg Extension", "strength", "Legs"),
    ("Leg Curl", "strength", "Legs"),
    ("Walking Lunge", "strength", "Legs"),
    ("Hip Thrust", "strength", "Glutes"),
    ("Calf Raise", "strength", "Legs"),
    ("Pull-Up", "bodyweight", "Back"),
    ("Chin-Up", "bodyweight", "Back"),
    ("Push-Up", "bodyweight", "Chest"),
    ("Dip", "bodyweight", "Chest"),
    ("Plank", "bodyweight", "Core"),
    ("Hanging Leg Raise", "bodyweight", "Core"),
    ("Running", "cardio", "Cardio"),
    ("Treadmill", "cardio", "Cardio"),
    ("Cycling", "cardio", "Cardio"),
    ("Rowing Machine", "cardio", "Cardio"),
    ("Elliptical", "cardio", "Cardio"),
    ("Stair Climber", "cardio", "Cardio"),
    ("Incline Walk", "cardio", "Cardio"),
    ("Swimming", "cardio", "Cardio"),
]


def seed_exercises(db: Session) -> int:
    existing = set(db.scalars(select(Exercise.name).where(Exercise.user_id.is_(None))))
    added = 0
    for name, modality, muscle_group in BUILT_IN:
        if name in existing:
            continue
        db.add(Exercise(name=name, modality=modality, muscle_group=muscle_group, user_id=None))
        added += 1
    if added:
        db.commit()
    return added
