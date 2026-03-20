from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or user.password_hash != payload.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return LoginResponse(
        access_token=f"demo-token-{user.user_id}",
        user={
            "user_id": user.user_id,
            "username": user.username,
            "name": f"{user.first_name} {user.last_name}",
            "role": user.role,
        },
    )
