import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("FITNESS_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'fitness.db'}")

# Generated once and persisted so restarts don't invalidate everyone's session.
_secret_file = DATA_DIR / ".jwt_secret"
if os.getenv("JWT_SECRET"):
    JWT_SECRET = os.environ["JWT_SECRET"]
else:
    if not _secret_file.exists():
        _secret_file.write_text(os.urandom(32).hex())
        _secret_file.chmod(0o600)
    JWT_SECRET = _secret_file.read_text().strip()

JWT_ALGORITHM = "HS256"
TOKEN_TTL_DAYS = int(os.getenv("TOKEN_TTL_DAYS", "30"))

# Empty list means "reflect any origin" for LAN use; set explicitly when exposed.
CORS_ORIGINS = [o for o in os.getenv("CORS_ORIGINS", "").split(",") if o]

# Set to false once both accounts exist to stop further signups.
ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "true").lower() != "false"
