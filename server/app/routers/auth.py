from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import ALLOW_REGISTRATION
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut, UserUpdate
from ..security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/registration-open")
def registration_open(db: Session = Depends(get_db)) -> dict:
    has_users = db.scalar(select(func.count(User.id))) > 0  # pylint: disable=not-callable
    return {"open": ALLOW_REGISTRATION or not has_users}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    has_users = db.scalar(select(func.count(User.id))) > 0  # pylint: disable=not-callable
    if has_users and not ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is closed")

    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="That email is already registered")

    user = User(
        email=email,
        display_name=payload.display_name.strip(),
        password_hash=hash_password(payload.password),
        unit=payload.unit,
    )
    db.add(user)
    db.commit()
    return TokenResponse(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenResponse(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> User:
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    if payload.unit is not None:
        user.unit = payload.unit
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    db.commit()
    return user
