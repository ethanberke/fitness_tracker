from datetime import date, timedelta


def exercise_id(client, auth, name):
    exercises = client.get("/api/exercises", headers=auth).json()
    return next(e["id"] for e in exercises if e["name"] == name)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_auth_required(client):
    assert client.get("/api/workouts").status_code == 401


def test_login_and_me(client, auth):
    login = client.post(
        "/api/auth/login",
        json={"email": "ethan@example.com", "password": "barbell-squats"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["display_name"] == "Ethan"

    bad = client.post(
        "/api/auth/login", json={"email": "ethan@example.com", "password": "wrong"}
    )
    assert bad.status_code == 401
    assert client.get("/api/auth/me", headers=auth).json()["unit"] == "lb"


def test_builtin_exercises_seeded(client, auth):
    exercises = client.get("/api/exercises", headers=auth).json()
    names = {e["name"] for e in exercises}
    assert {"Barbell Bench Press", "Pull-Up", "Running"} <= names
    assert next(e for e in exercises if e["name"] == "Running")["modality"] == "cardio"


def test_custom_exercise_lifecycle(client, auth):
    created = client.post(
        "/api/exercises",
        headers=auth,
        json={"name": "Landmine Press", "modality": "strength", "muscle_group": "Shoulders"},
    )
    assert created.status_code == 201
    duplicate = client.post(
        "/api/exercises", headers=auth, json={"name": "landmine press", "modality": "strength"}
    )
    assert duplicate.status_code == 409
    assert client.delete(f"/api/exercises/{created.json()['id']}", headers=auth).status_code == 204


def test_routine_crud_and_prefill(client, auth):
    bench = exercise_id(client, auth, "Barbell Bench Press")
    press = exercise_id(client, auth, "Overhead Press")

    routine = client.post(
        "/api/routines",
        headers=auth,
        json={
            "name": "Push Day",
            "items": [
                {"exercise_id": bench, "target_sets": 3, "target_reps": 5},
                {"exercise_id": press, "target_sets": 3, "target_reps": 8},
            ],
        },
    )
    assert routine.status_code == 201
    body = routine.json()
    assert [i["exercise"]["name"] for i in body["items"]] == ["Barbell Bench Press", "Overhead Press"]

    updated = client.put(
        f"/api/routines/{body['id']}",
        headers=auth,
        json={"name": "Push Day A", "items": [{"exercise_id": bench, "target_sets": 4}]},
    )
    assert updated.status_code == 200
    assert len(updated.json()["items"]) == 1
    assert updated.json()["name"] == "Push Day A"

    prefill = client.get("/api/workouts/prefill", headers=auth, params={"routine_id": body["id"]})
    assert prefill.status_code == 200
    assert prefill.json()[0]["target_sets"] == 4


def test_workout_logging_roundtrip_and_units(client, auth):
    bench = exercise_id(client, auth, "Barbell Bench Press")
    today = date.today()

    created = client.post(
        "/api/workouts",
        headers=auth,
        json={
            "date": today.isoformat(),
            "name": "Push",
            "sets": [
                {"exercise_id": bench, "set_number": 1, "weight": 185, "reps": 5},
                {"exercise_id": bench, "set_number": 2, "weight": 185, "reps": 5},
                {"exercise_id": bench, "set_number": 3, "weight": 195, "reps": 3},
            ],
        },
    )
    assert created.status_code == 201, created.text
    workout = created.json()
    # Round-trips through canonical kilograms without drifting.
    assert [s["weight"] for s in workout["sets"]] == [185.0, 185.0, 195.0]
    assert workout["total_volume"] == 185 * 5 + 185 * 5 + 195 * 3
    assert workout["set_count"] == 3

    listed = client.get("/api/workouts", headers=auth).json()
    assert listed[0]["exercise_names"] == ["Barbell Bench Press"]

    fetched = client.get(f"/api/workouts/{workout['id']}", headers=auth)
    assert fetched.json()["sets"][2]["reps"] == 3


def test_unit_switch_preserves_history(client, auth):
    workouts = client.get("/api/workouts", headers=auth).json()
    workout_id = workouts[0]["id"]
    in_lb = client.get(f"/api/workouts/{workout_id}", headers=auth).json()["sets"][0]["weight"]

    client.patch("/api/auth/me", headers=auth, json={"unit": "kg"})
    in_kg = client.get(f"/api/workouts/{workout_id}", headers=auth).json()["sets"][0]["weight"]
    assert abs(in_kg - in_lb * 0.45359237) < 0.05

    client.patch("/api/auth/me", headers=auth, json={"unit": "lb"})
    assert client.get(f"/api/workouts/{workout_id}", headers=auth).json()["sets"][0]["weight"] == in_lb


def test_progress_series_strength(client, auth):
    bench = exercise_id(client, auth, "Barbell Bench Press")
    older = (date.today() - timedelta(days=14)).isoformat()
    client.post(
        "/api/workouts",
        headers=auth,
        json={
            "date": older,
            "sets": [{"exercise_id": bench, "set_number": 1, "weight": 165, "reps": 5}],
        },
    )

    series = client.get(
        "/api/progress/series", headers=auth, params={"exercise_id": bench, "metric": "est_1rm"}
    ).json()
    assert series["unit"] == "lb"
    assert [p["date"] for p in series["points"]] == sorted(p["date"] for p in series["points"])
    assert series["points"][0]["value"] == round(165 * (1 + 5 / 30), 1)
    assert series["change_pct"] > 0  # 165x5 -> 185x5 is progress
    # Epley ranks 185x5 (215.8) above 195x3 (214.5), so the top set is not the best estimate.
    assert series["best"]["label"] == "185 lb × 5"

    volume = client.get(
        "/api/progress/series", headers=auth, params={"exercise_id": bench, "metric": "volume"}
    ).json()
    assert volume["points"][-1]["value"] == 185 * 5 + 185 * 5 + 195 * 3

    bad_metric = client.get(
        "/api/progress/series", headers=auth, params={"exercise_id": bench, "metric": "pace"}
    )
    assert bad_metric.status_code == 400


def test_progress_series_cardio_pace(client, auth):
    running = exercise_id(client, auth, "Running")
    client.post(
        "/api/workouts",
        headers=auth,
        json={
            "date": date.today().isoformat(),
            "sets": [
                {"exercise_id": running, "set_number": 1, "distance": 3.0, "duration_s": 1620}
            ],
        },
    )
    series = client.get(
        "/api/progress/series", headers=auth, params={"exercise_id": running, "metric": "pace"}
    ).json()
    assert series["unit"] == "min/mi"
    assert series["points"][0]["value"] == 9.0  # 27:00 over 3 miles
    assert series["points"][0]["label"] == "9:00 /mi"


def test_dashboard_and_prs_and_export(client, auth):
    dashboard = client.get("/api/progress/dashboard", headers=auth).json()
    assert dashboard["workouts_total"] >= 2
    assert dashboard["volume_unit"] == "lb"
    assert dashboard["weekly_volume"]
    assert dashboard["current_streak_weeks"] >= 1

    prs = client.get("/api/progress/prs", headers=auth).json()
    bench_pr = next(p for p in prs if p["exercise_name"] == "Barbell Bench Press")
    assert bench_pr["label"] == "185 lb × 5"
    assert bench_pr["value"] == round(185 * (1 + 5 / 30), 1)

    csv = client.get("/api/progress/export.csv", headers=auth)
    assert csv.status_code == 200
    assert "Barbell Bench Press" in csv.text


def test_data_is_scoped_per_user(client, auth):
    other = client.post(
        "/api/auth/register",
        json={
            "email": "adrienne@example.com",
            "display_name": "Adrienne",
            "password": "kettlebell-swings",
            "unit": "lb",
        },
    ).json()
    other_auth = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get("/api/workouts", headers=other_auth).json() == []
    assert client.get("/api/routines", headers=other_auth).json() == []

    mine = client.get("/api/workouts", headers=auth).json()[0]["id"]
    assert client.get(f"/api/workouts/{mine}", headers=other_auth).status_code == 404


def test_workout_delete(client, auth):
    workouts = client.get("/api/workouts", headers=auth).json()
    target = workouts[0]["id"]
    assert client.delete(f"/api/workouts/{target}", headers=auth).status_code == 204
    assert client.get(f"/api/workouts/{target}", headers=auth).status_code == 404
