# Claude Code Context — Fitness Tracker

Reference for Claude when working on this repository. Inherits the conventions in
`/home/ethanbthatsme/projects/.claude/CLAUDE.md` (no semicolons, 2-space indent,
ES modules, clarity over cleverness).

## ⚡ Quick Start for Claude

```bash
./dev.sh                                          # API :8000 + Vite :5173 (LAN-visible)
server/.venv/bin/python -m pytest server -q       # backend tests (13, all should pass)
server/.venv/bin/ruff check .                     # fast Python lint (also the pre-commit hook)
server/.venv/bin/python -m pylint server/app server/scripts server/tests   # must stay 10.00
npm run lint                                      # eslint (0 errors; 2 known warnings)
npm run build                                     # typecheck-by-bundling; catches import errors
docker compose up -d --build                      # production: one image, one port
```

There is no frontend test suite. `npm run build` is the fastest way to catch a
broken import or a bad prop before a human sees it.

`.github/workflows/ci.yml` runs all four on every push and PR, and publishes the
image only when they pass.

## What This Is

A two-person gym log — Ethan and his wife — hosted on a Proxmox homelab and used
from phones. Log sets at the rack, save push/pull/leg routines, watch progress
lines. Not a product; optimize for "one-handed at the gym" and for staying easy
to run for years.

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI + SQLAlchemy | Async-capable, pydantic validation for free |
| Analysis | pandas | Every progress series is a groupby, not hand-rolled loops |
| DB | SQLite file at `data/fitness.db` | Two users; one file to back up. Postgres via `DATABASE_URL`, no code change |
| Frontend | Vite + React 18 + MUI v6 | MUI's touch components (pickers, steppers) carry the phone UX |
| Charts | `@mui/x-charts` v7 | Interactive on a phone; pandas still does the math server-side |
| Auth | JWT, bcrypt | Real login so it survives being exposed beyond the LAN |

## Architecture

```
src/                        React app (Vite root is the repo root)
├── api/client.js           fetch wrapper: JWT header, error unwrapping, 401 → logout
├── context/                AuthContext (session), ColorModeContext (light/dark/system)
├── components/             AppShell (nav), charts, NumberField, ExercisePicker
└── pages/                  Dashboard, LogWorkout, Progress, Routines, History, Settings

server/
├── app/
│   ├── main.py             app factory, CORS, SPA fallback for ./static
│   ├── config.py           env + persisted JWT secret
│   ├── db.py               engine, session, SQLite pragmas (WAL, foreign_keys)
│   ├── models.py           users, exercises, routines/routine_items, workouts/set_entries
│   ├── schemas.py          pydantic in/out
│   ├── units.py            lb↔kg, mi↔km at the API boundary
│   ├── security.py         bcrypt, JWT, current_user dependency
│   ├── seed.py             44 built-in exercises, seeded on first boot
│   └── routers/            auth, exercises, routines, workouts, progress
├── scripts/demo_data.py    ~10 weeks of plausible workouts
└── tests/test_api.py       full-API pytest suite
```

```
users ──< workouts ──< set_entries >── exercises
      └─< routines ──< routine_items >──┘
```

## Invariants — break these and things go subtly wrong

**1. Sets store canonical kg, meters, seconds.** `units.py` converts at the API
boundary using the user's `unit` preference. Never store what the user typed.
Switching lb→kg must relabel history, not rewrite rows — `test_unit_switch_preserves_history`
guards this.

**2. Modality decides everything downstream.** An exercise is `strength`
(weight × reps), `bodyweight` (reps), or `cardio` (distance + time). It drives which
input fields render, which metrics `/api/progress/series` offers, and which PR
calculation applies. Adding a modality means touching `METRICS_BY_MODALITY`,
`blankSet()`, and the set-row renderer in `LogWorkout.jsx` together.

**3. Pace is the one lower-is-better metric.** It lives in `LOWER_IS_BETTER` in
`progress.py`, which flips the sign of `change_pct`; the chart separately inverts
its y-axis (`reverse: isPace`). Both are needed for "improvement reads as up."

**4. Every query is scoped by `user_id`.** Routers take `user: User = Depends(current_user)`
and filter on it — including the pandas frames, which start from a user-filtered
statement. `test_data_is_scoped_per_user` guards this.

**5. Chart colors are validated, not chosen.** The tokens in `src/theme.js` passed
the dataviz skill's six checks (CVD separation, chroma floor, lightness band,
≥3:1 contrast) against both surfaces. Re-run `validate_palette.js` before changing
a hex. Related rules the charts follow deliberately: single series → no legend box,
2px lines, ≥8px markers with a 2px surface ring, recessive hairline grid, and a
table view on the Progress page so nothing is color-only.

**6. Weeks are Monday-anchored** in `dashboard()` — matches how a training week is
planned, and the streak counter walks back in 7-day steps from it.

## Gotchas

- **`@mui/x-charts` is v7, not v8.** Hide a legend with
  `slotProps={{ legend: { hidden: true } }}` — `hideLegend` is v8. Axis `width` is
  also v8; reserve space with `margin` instead. Both were caught the hard way.
- **`server/main.py` and `server/migration.sql` are the April 2026 prototype.**
  Superseded by `server/app/`, wired into nothing, kept for history. Don't extend
  them, and note that `uvicorn --app-dir server` makes `main:app` and `app.main:app`
  both resolvable — the real one is `app.main:app`.
- **The SPA fallback 404s paths with a file extension.** `/nope.png` returns 404
  rather than `index.html`, so a typo'd asset reference fails loudly; extensionless
  paths (`/progress`, `/history`) still serve the app for client-side routing.
- **`data/` holds the JWT signing secret** (`.jwt_secret`, generated on first boot)
  alongside the SQLite file. It is gitignored; deleting it signs everyone out.
- **`server/static/` is build output** — `npm run build && cp -r dist server/static`,
  or just let the Dockerfile do it. Gitignored.
- **Registration closes via `ALLOW_REGISTRATION=false`**, but the first account can
  always be created so a fresh deploy is never locked out.

## Common Tasks

### Add a progress metric

1. `METRICS_BY_MODALITY` + `METRIC_LABELS` in `server/app/routers/progress.py`
2. A branch in `series()` that builds `SeriesPoint`s — set `unit`, and write a
   `label` a human would read at the gym (`"185 lb × 5"`, not `"215.8"`)
3. Add to `LOWER_IS_BETTER` if smaller is better
4. `METRIC_LABELS` in `src/pages/Progress.jsx` (the toggle-button label)
5. A test asserting the computed value, following `test_progress_series_cardio_pace`

### Add an API endpoint

Router in `server/app/routers/`, `current_user` dependency, response model in
`schemas.py`, method on `api` in `src/api/client.js`, test in `server/tests/test_api.py`.

### Change the schema

There are no migrations — `Base.metadata.create_all` runs at startup and only
creates missing tables. An additive nullable column is free; anything else means
either a hand-written `ALTER TABLE` against `data/fitness.db` or adopting Alembic.
Back up the file first (`sqlite3 data/fitness.db ".backup 'backup.db'"`).

## Testing Before Committing

```bash
server/.venv/bin/python -m pytest server -q                               # must be green
server/.venv/bin/python -m pylint server/app server/scripts server/tests  # must stay 10.00
npm run lint                                                              # 0 errors
npm run build                                                             # must succeed
```

**The pre-commit hook** (`.githooks/pre-commit`) runs ruff and eslint on *staged
files only*, so it costs well under a second. `dev.sh` enables it; otherwise
`git config core.hooksPath .githooks`. Bypass with `SKIP_HOOKS=true git commit`,
matching the convention in the workspace `git-enforcer` tool. Deliberately not in
the hook: pylint, pytest, and the frontend build — CI covers those, and a hook
that takes ten seconds is a hook people disable.

**Two Python linters on purpose.** Ruff is the fast gate (hook + first CI step);
pylint is the deeper one (design checks, `too-many-*`, SQLAlchemy-aware analysis
ruff doesn't do). They're configured to agree: same 120-column limit, same
exclusion of the legacy `server/main.py`. Ruff's `B008` is turned off through
`extend-immutable-calls` rather than a blanket ignore, because `Depends()` in a
default argument is the FastAPI idiom and B008 is otherwise worth having.

**Lint conventions.** `.pylintrc` disables the docstring checks deliberately —
house style is minimal comments, and pydantic schemas and FastAPI routes describe
themselves. Where a check is silenced for a specific line, the reason is in a
comment beside it (SQLAlchemy's `func.count` false positive, `SessionLocal`'s
naming, the size of `series()` — issue #10). Prefer that over widening `.pylintrc`.
ESLint's two remaining warnings are context files exporting their own hook, which
is idiomatic; the Fast Refresh caveat is not worth restructuring for.

Security checklist for this repo: no secrets in the tree (`data/` is ignored),
weights still round-trip through kg, and cross-user isolation tests still pass.

## Reading Order for New Context

1. **README.md** — what it is, how to run and deploy it
2. **This file** — invariants and gotchas
3. **`server/app/models.py`** — the data model everything else serves
4. **`server/app/routers/progress.py`** — where the pandas work lives
5. **`src/pages/LogWorkout.jsx`** — the screen that matters most in practice

---

**Last updated:** Initial build — FastAPI + pandas backend, Vite + MUI frontend,
merged with the April 2026 prototype history.
