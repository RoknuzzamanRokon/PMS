from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Guest
from ..schemas import GuestCreate, GuestRead
from ..utils import next_code

router = APIRouter(prefix="/api/v1/guests", tags=["guests"])


@router.get("/all", response_model=list[GuestRead])
def list_guests(db: Session = Depends(get_db)):
    return db.execute(select(Guest).order_by(Guest.created_at.desc())).scalars().all()


@router.post("", response_model=GuestRead)
def create_guest(payload: GuestCreate, db: Session = Depends(get_db)):
    guest_id = payload.guest_id or next_code(db, Guest, "guest_id", "GST")
    guest = Guest(guest_id=guest_id, **payload.model_dump(exclude={"guest_id"}))
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


@router.get("/{guest_id}", response_model=GuestRead)
def get_guest(guest_id: str, db: Session = Depends(get_db)):
    guest = db.scalar(select(Guest).where(Guest.guest_id == guest_id))
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return guest
