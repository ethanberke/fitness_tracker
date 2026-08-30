"""Populate an account with ~10 weeks of plausible workouts.

Useful for seeing the charts before you've logged anything real:

    server/.venv/bin/python server/scripts/demo_data.py you@example.com yourpassword

Delete it later from History, or start clean by removing data/fitness.db.
"""

import argparse
import random
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000/api"


def call(path, payload=None, token=None, method=None):
    data = None
    headers = {}
    if payload is not None:
        import json

        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            import json

            body = response.read().decode()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        print(f"{error.code} {path}: {error.read().decode()}", file=sys.stderr)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("password")
    parser.add_argument("--weeks", type=int, default=10)
    args = parser.parse_args()

    token = call("/auth/login", {"email": args.email, "password": args.password})["access_token"]
    exercises = {e["name"]: e for e in call("/exercises", token=token)}

    push = ["Barbell Bench Press", "Overhead Press", "Incline Dumbbell Press", "Triceps Pushdown"]
    pull = ["Deadlift", "Barbell Row", "Lat Pulldown", "Barbell Curl"]
    legs = ["Back Squat", "Romanian Deadlift", "Leg Press", "Calf Raise"]

    for name, plan in (("Push Day", push), ("Pull Day", pull), ("Leg Day", legs)):
        call(
            "/routines",
            {
                "name": name,
                "items": [
                    {"exercise_id": exercises[e]["id"], "target_sets": 3, "target_reps": 8}
                    for e in plan
                ],
            },
            token=token,
        )

    starting = {
        "Barbell Bench Press": 155, "Overhead Press": 95, "Incline Dumbbell Press": 50,
        "Triceps Pushdown": 40, "Deadlift": 225, "Barbell Row": 135, "Lat Pulldown": 110,
        "Barbell Curl": 60, "Back Squat": 185, "Romanian Deadlift": 155, "Leg Press": 270,
        "Calf Raise": 90,
    }

    today = date.today()
    logged = 0
    for week in range(args.weeks, 0, -1):
        monday = today - timedelta(days=today.weekday() + 7 * (week - 1))
        for offset, (name, plan) in enumerate((("Push Day", push), ("Pull Day", pull), ("Leg Day", legs))):
            day = monday + timedelta(days=offset * 2)
            if day > today:
                continue
            sets = []
            for exercise_name in plan:
                # ~2.5% progression a week with a little day-to-day noise.
                base = starting[exercise_name] * (1 + 0.025 * (args.weeks - week))
                weight = round(base * random.uniform(0.97, 1.03) / 5) * 5
                for set_number in range(1, 4):
                    sets.append(
                        {
                            "exercise_id": exercises[exercise_name]["id"],
                            "set_number": set_number,
                            "weight": weight,
                            "reps": random.choice([6, 8, 8, 10]),
                        }
                    )
            call(
                "/workouts",
                {"date": day.isoformat(), "name": name, "sets": sets},
                token=token,
            )
            logged += 1

        run_day = monday + timedelta(days=5)
        if run_day <= today:
            distance = round(random.uniform(2.5, 4.0), 2)
            # Pace drifts faster over the block: 9:40/mi down toward 8:40/mi.
            pace = 9.7 - 0.1 * (args.weeks - week) + random.uniform(-0.15, 0.15)
            call(
                "/workouts",
                {
                    "date": run_day.isoformat(),
                    "name": "Easy run",
                    "sets": [
                        {
                            "exercise_id": exercises["Running"]["id"],
                            "set_number": 1,
                            "distance": distance,
                            "duration_s": int(distance * pace * 60),
                        }
                    ],
                },
                token=token,
            )
            logged += 1

    print(f"Created {logged} workouts and 3 routines for {args.email}")


if __name__ == "__main__":
    main()
