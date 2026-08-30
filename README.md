# Fitness Tracker

A two-person gym log for phones: type in what you lifted, save your usual push/pull
days as routines, and watch the lines move.

- **Backend** — FastAPI + SQLAlchemy, pandas for every progress calculation
- **Frontend** — React (Vite) + MUI, mobile-first with a bottom nav
- **Database** — SQLite file (`data/fitness.db`); swap in Postgres by setting `DATABASE_URL`
- **Auth** — email + password, JWT; each account only ever sees its own workouts

## Quick start (development)

```bash
./dev.sh
```

That runs the API on `http://localhost:8000` and Vite on `http://localhost:5173`
(`--host`, so your phone can hit it at `http://<your-ip>:5173` while you iterate).
Open the Vite URL, create your account, and you're logging.

Run the two halves by hand instead:

```bash
python3 -m venv server/.venv && server/.venv/bin/pip install -r server/requirements.txt
server/.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --port 8000

npm install && npm run dev -- --host
```

### Tests

```bash
server/.venv/bin/python -m pytest server -q
```

### Demo data

Want to see the charts before your first session:

```bash
server/.venv/bin/python server/scripts/demo_data.py you@example.com yourpassword
```

That writes ~10 weeks of workouts plus three routines into your account. Remove
them from History, or start clean by deleting `data/fitness.db`.

## Deploying on the homelab

```bash
docker compose up -d --build
```

One container, one port (`8000`), serving both the API and the built frontend.
The `./data` bind mount holds the SQLite file and the JWT signing secret, so
restarts don't sign anyone out.

Once you and your wife have both registered, close signups:

```yaml
environment:
  ALLOW_REGISTRATION: "false"
```

…then `docker compose up -d` again.

### Reaching it from your phones

Ranked by how little of it faces the internet:

1. **Tailscale** (recommended) — install it on the Proxmox host or LXC and on both
   phones; hit `http://<tailscale-name>:8000` from anywhere with nothing exposed.
2. **Cloudflare Tunnel** — public HTTPS hostname, no port forwarding, and you can
   put Cloudflare Access in front so only your two logins get through.
3. **Reverse proxy on the LAN** — Caddy or Nginx Proxy Manager terminating TLS with
   a Let's Encrypt cert via DNS-01, proxying to `fitness:8000`.

Plain HTTP over the LAN works too, but the login form and its JWT travel in the
clear on your network — fine at home, not fine over a port forward. If you do
expose it publicly, set an explicit origin list:

```yaml
environment:
  CORS_ORIGINS: "https://fitness.example.com"
  JWT_SECRET: "<a long random string>"
```

### Backups

Everything is one file. With the container stopped, or using SQLite's online backup:

```bash
sqlite3 data/fitness.db ".backup '/backups/fitness-$(date +%F).db'"
```

`data/fitness.db-wal` and `-shm` are transient — the `.backup` command folds them in.

### Moving to Postgres later

The schema is plain SQLAlchemy, so nothing in the code changes:

```yaml
environment:
  DATABASE_URL: "postgresql+psycopg://user:pass@postgres:5432/fitness"
```

Add `psycopg[binary]` to `server/requirements.txt`, then migrate the rows with your
tool of choice (`pgloader` handles SQLite→Postgres in one command).

## How it works

### Data model

```
users ──< workouts ──< set_entries >── exercises
      └─< routines ──< routine_items >──┘
```

- **Exercises** are either built-in (seeded on first boot, shared) or custom
  (yours alone). Each has a modality that decides what you get asked for:
  `strength` (weight × reps), `bodyweight` (reps), `cardio` (distance + time).
- **Sets** store canonical **kilograms, meters, and seconds**. Your `lb`/`kg`
  preference converts at the API boundary, so switching units re-labels your whole
  history instead of corrupting it.
- **Routines** are templates: an ordered list of exercises with target sets/reps.
  Starting a workout from one fills in the exercises *and* last session's numbers,
  so a typical set is one tap on `+` away from correct.

### Progress metrics (pandas)

`/api/progress/series` groups your sets by day and computes, per modality:

| Modality | Metrics |
|---|---|
| strength | estimated 1RM (Epley: `w × (1 + reps/30)`), top set weight, session volume, total reps |
| bodyweight | best set, total reps, volume |
| cardio | pace, distance, duration, average speed |

Pace is the one metric where lower is better — the chart's y-axis inverts and
"change" flips sign so improvement always reads as up and to the right.

`/api/progress/dashboard` returns Monday-anchored weekly volume, your current
streak, and recent PRs. `/api/progress/export.csv` dumps every set as a flat CSV
if you'd rather do your own analysis in a notebook.

## Project layout

```
├── src/                  # React app (pages, components, api client, contexts)
├── server/
│   ├── app/
│   │   ├── main.py       # FastAPI app; serves ./static in production
│   │   ├── models.py     # SQLAlchemy tables
│   │   ├── units.py      # lb/kg, mi/km conversion at the API boundary
│   │   └── routers/      # auth, exercises, routines, workouts, progress
│   ├── scripts/          # demo_data.py
│   └── tests/            # pytest suite over the whole API
├── Dockerfile            # node build → python runtime, one image
└── docker-compose.yml
```
