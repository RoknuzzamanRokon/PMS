from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Payment, RatePlan, Reservation, ReservationRoom, Room
from ..schemas import (
    PaymentCreate,
    PaymentRead,
    ReservationCreate,
    ReservationRead,
    ReservationStatusUpdate,
    ReservationUpdate,
)
from ..utils import next_code

router = APIRouter(prefix="/api/v1/reservations", tags=["reservations"])


def serialize_reservation(reservation: Reservation, db: Session):
    reservation_rooms = (
        db.execute(select(ReservationRoom).where(ReservationRoom.booking_id == reservation.booking_id))
        .scalars()
        .all()
    )
    night_count = max(1, (reservation.check_out_date - reservation.check_in_date).days)
    base_price = sum(Decimal(item.room_rate_snapshot or 0) for item in reservation_rooms) * Decimal(night_count)
    tax_price = sum(Decimal(item.tax_snapshot or 0) for item in reservation_rooms) * Decimal(night_count)
    per_night_price = Decimal(reservation.total_price) / Decimal(night_count)

    return {
        "booking_id": reservation.booking_id,
        "property_id": reservation.property_id,
        "guest_id": reservation.guest_id,
        "check_in_date": reservation.check_in_date,
        "check_out_date": reservation.check_out_date,
        "total_price": reservation.total_price,
        "price": {
            "base_price": base_price,
            "tax_price": tax_price,
            "per_night_price": per_night_price,
            "total_price": reservation.total_price,
        },
        "currency": reservation.currency,
        "booking_status": reservation.booking_status,
        "created_at": reservation.created_at,
        "updated_at": reservation.updated_at,
    }


def recalculate_reservation_total(reservation: Reservation, db: Session) -> Decimal:
    reservation_rooms = (
        db.execute(select(ReservationRoom).where(ReservationRoom.booking_id == reservation.booking_id))
        .scalars()
        .all()
    )
    night_count = max(1, (reservation.check_out_date - reservation.check_in_date).days)
    nightly_total = sum(
        Decimal(item.room_rate_snapshot or 0) + Decimal(item.tax_snapshot or 0)
        for item in reservation_rooms
    )
    total_price = nightly_total * Decimal(night_count)
    reservation.total_price = total_price
    return total_price


@router.post("", response_model=ReservationRead)
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db)):
    today = date.today()
    if payload.check_in_date < today:
        raise HTTPException(
            status_code=422,
            detail=f"Check-in date cannot be in the past. Please use {today.isoformat()} or a later date.",
        )
    if payload.check_out_date <= payload.check_in_date:
        raise HTTPException(
            status_code=422,
            detail="Check-out date must be later than check-in date.",
        )

    booking_id = payload.booking_id or next_code(db, Reservation, "booking_id", "BOOK")
    night_count = (payload.check_out_date - payload.check_in_date).days
    total_price = Decimal("0")

    room_payloads = payload.rooms or []
    for item in room_payloads:
        rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == item.rate_id))
        if not rate_plan:
            raise HTTPException(status_code=404, detail=f"Rate plan not found: {item.rate_id}")
        nightly_total = Decimal(rate_plan.base_rate) + Decimal(rate_plan.tax_and_service_fee)
        total_price += nightly_total * Decimal(night_count)

    reservation = Reservation(
        booking_id=booking_id,
        property_id=payload.property_id,
        guest_id=payload.guest_id,
        check_in_date=payload.check_in_date,
        check_out_date=payload.check_out_date,
        total_price=total_price,
        currency=payload.currency,
        booking_status=payload.booking_status,
    )
    db.add(reservation)

    for item in room_payloads:
        room = db.scalar(select(Room).where(Room.room_id == item.room_id))
        rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == item.rate_id))
        db.add(
            ReservationRoom(
                booking_id=booking_id,
                room_id=item.room_id,
                rate_id=item.rate_id,
                room_name=room.room_name if room else item.room_id,
                room_name_lang=room.room_name_lang if room else None,
                room_rate_snapshot=rate_plan.base_rate if rate_plan else 0,
                tax_snapshot=rate_plan.tax_and_service_fee if rate_plan else 0,
                occupant_name=item.occupant_name,
            )
        )

    db.commit()
    db.refresh(reservation)
    return serialize_reservation(reservation, db)


@router.get("/{booking_id}", response_model=ReservationRead)
def get_reservation(booking_id: str, db: Session = Depends(get_db)):
    reservation = db.scalar(select(Reservation).where(Reservation.booking_id == booking_id))
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return serialize_reservation(reservation, db)


@router.patch("/{booking_id}", response_model=ReservationRead)
def update_reservation(
    booking_id: str,
    payload: ReservationUpdate,
    db: Session = Depends(get_db),
):
    reservation = db.scalar(select(Reservation).where(Reservation.booking_id == booking_id))
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    next_check_in_date = payload.check_in_date or reservation.check_in_date
    next_check_out_date = payload.check_out_date or reservation.check_out_date
    today = date.today()

    if next_check_in_date < today:
        raise HTTPException(
            status_code=422,
            detail=f"Check-in date cannot be in the past. Please use {today.isoformat()} or a later date.",
        )
    if next_check_out_date <= next_check_in_date:
        raise HTTPException(
            status_code=422,
            detail="Check-out date must be later than check-in date.",
        )

    reservation.check_in_date = next_check_in_date
    reservation.check_out_date = next_check_out_date

    if payload.booking_status is not None:
        reservation.booking_status = payload.booking_status
    if payload.currency is not None:
        reservation.currency = payload.currency

    recalculate_reservation_total(reservation, db)
    db.commit()
    db.refresh(reservation)
    return serialize_reservation(reservation, db)


@router.patch("/{booking_id}/status", response_model=ReservationRead)
def update_reservation_status(
    booking_id: str,
    payload: ReservationStatusUpdate,
    db: Session = Depends(get_db),
):
    reservation = db.scalar(select(Reservation).where(Reservation.booking_id == booking_id))
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    reservation.booking_status = payload.booking_status
    recalculate_reservation_total(reservation, db)
    db.commit()
    db.refresh(reservation)
    return serialize_reservation(reservation, db)


@router.post("/{booking_id}/payments", response_model=PaymentRead)
def create_payment(booking_id: str, payload: PaymentCreate, db: Session = Depends(get_db)):
    reservation = db.scalar(select(Reservation).where(Reservation.booking_id == booking_id))
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    payment_id = payload.payment_id or next_code(db, Payment, "payment_id", "PAY")
    payment = Payment(
        payment_id=payment_id,
        booking_id=booking_id,
        **payload.model_dump(exclude={"payment_id"}),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{booking_id}/payments", response_model=list[PaymentRead])
def list_payments(booking_id: str, db: Session = Depends(get_db)):
    return (
        db.execute(select(Payment).where(Payment.booking_id == booking_id).order_by(Payment.created_at.desc()))
        .scalars()
        .all()
    )
