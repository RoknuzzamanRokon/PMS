from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Payment, RateCalendar, RatePlan, Reservation, ReservationRoom, Room
from ..schemas import (
    AvailableReservationRoom,
    PaymentCreate,
    PaymentRead,
    ReservationAvailabilityRequest,
    ReservationAvailabilityResponse,
    ReservationCreate,
    ReservationRead,
    ReservationStatusUpdate,
    ReservationUpdate,
)
from ..utils import next_code

router = APIRouter(prefix="/api/v1/reservations", tags=["reservations"])
UNAVAILABLE_CALENDAR_STATUSES = {"SOLD_OUT", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED"}


def validate_reservation_dates(check_in_date: date, check_out_date: date) -> None:
    today = date.today()
    if check_in_date < today:
        raise HTTPException(
            status_code=422,
            detail=f"Check-in date cannot be in the past. Please use {today.isoformat()} or a later date.",
        )
    if check_out_date <= check_in_date:
        raise HTTPException(
            status_code=422,
            detail="Check-out date must be later than check-in date.",
        )


def get_available_room_options(
    db: Session,
    property_id: str,
    check_in_date: date,
    check_out_date: date,
    currency: str,
    exclude_booking_id: str | None = None,
) -> list[dict]:
    rooms = (
        db.execute(select(Room).where(Room.property_id == property_id).order_by(Room.room_name.asc()))
        .scalars()
        .all()
    )
    room_ids = [room.room_id for room in rooms]
    if not room_ids:
        return []

    rate_plans = (
        db.execute(
            select(RatePlan)
            .where(RatePlan.room_id.in_(room_ids))
            .order_by(RatePlan.room_id.asc(), RatePlan.status.desc(), RatePlan.base_rate.asc())
        )
        .scalars()
        .all()
    )

    rate_plan_by_room = {}
    total_nights = (check_out_date - check_in_date).days

    for rate_plan in rate_plans:
        if rate_plan.room_id in rate_plan_by_room:
            continue
        if not rate_plan.status:
            continue
        if rate_plan.stop_sell or rate_plan.closed_to_arrival or rate_plan.closed_to_departure:
            continue
        if total_nights < rate_plan.min_stay or total_nights > rate_plan.max_stay:
            continue
        if rate_plan.available_inventory <= 0:
            continue

        rate_plan_by_room[rate_plan.room_id] = rate_plan

    available_rooms = []
    expected_dates = {check_in_date + timedelta(days=offset) for offset in range(total_nights)}
    for room in rooms:
        rate_plan = rate_plan_by_room.get(room.room_id)
        if not rate_plan:
            continue

        calendars = (
            db.execute(
                select(RateCalendar).where(
                    RateCalendar.rate_id == rate_plan.rate_id,
                    RateCalendar.stay_date >= check_in_date,
                    RateCalendar.stay_date < check_out_date,
                )
            )
            .scalars()
            .all()
        )
        if len(calendars) != total_nights:
            continue
        if {item.stay_date for item in calendars} != expected_dates:
            continue
        if any(item.availability in UNAVAILABLE_CALENDAR_STATUSES for item in calendars):
            continue

        nightly_base_total = sum(Decimal(item.base_rate) for item in calendars)
        nightly_tax_total = sum(Decimal(item.tax) for item in calendars)
        total_price = nightly_base_total + nightly_tax_total
        average_base_rate = nightly_base_total / Decimal(total_nights)
        average_tax_rate = nightly_tax_total / Decimal(total_nights)
        available_rooms.append(
            {
                "room_id": room.room_id,
                "room_name": room.room_name,
                "room_name_lang": room.room_name_lang,
                "room_status": room.room_status,
                "rate_id": rate_plan.rate_id,
                "rate_title": rate_plan.title,
                "meal_plan": rate_plan.meal_plan,
                "currency": currency or rate_plan.currency,
                "base_rate": average_base_rate,
                "tax_and_service_fee": average_tax_rate,
                "total_nights": total_nights,
                "total_price": total_price,
            }
        )

    return available_rooms


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
    validate_reservation_dates(payload.check_in_date, payload.check_out_date)

    booking_id = payload.booking_id or next_code(db, Reservation, "booking_id", "BOOK")
    night_count = (payload.check_out_date - payload.check_in_date).days
    total_price = Decimal("0")
    available_room_options = get_available_room_options(
        db,
        payload.property_id,
        payload.check_in_date,
        payload.check_out_date,
        payload.currency,
    )
    available_room_rate_pairs = {(item["room_id"], item["rate_id"]) for item in available_room_options}
    available_room_options_by_pair = {
        (item["room_id"], item["rate_id"]): item for item in available_room_options
    }

    room_payloads = payload.rooms or []
    selected_room_ids = set()
    for item in room_payloads:
        if item.room_id in selected_room_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Room {item.room_id} cannot be booked more than once in the same reservation.",
            )
        selected_room_ids.add(item.room_id)
        if (item.room_id, item.rate_id) not in available_room_rate_pairs:
            raise HTTPException(
                status_code=422,
                detail=f"Room {item.room_id} with rate plan {item.rate_id} is not available for the selected dates.",
            )
        rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == item.rate_id))
        if not rate_plan:
            raise HTTPException(status_code=404, detail=f"Rate plan not found: {item.rate_id}")
        available_option = available_room_options_by_pair[(item.room_id, item.rate_id)]
        total_price += Decimal(available_option["total_price"])

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
        available_option = available_room_options_by_pair[(item.room_id, item.rate_id)]
        db.add(
            ReservationRoom(
                booking_id=booking_id,
                room_id=item.room_id,
                rate_id=item.rate_id,
                room_name=room.room_name if room else item.room_id,
                room_name_lang=room.room_name_lang if room else None,
                room_rate_snapshot=available_option["base_rate"] if rate_plan else 0,
                tax_snapshot=available_option["tax_and_service_fee"] if rate_plan else 0,
                occupant_name=item.occupant_name,
            )
        )

    db.commit()
    db.refresh(reservation)
    return serialize_reservation(reservation, db)


@router.post("/available-rooms", response_model=ReservationAvailabilityResponse)
def list_available_rooms_for_reservation(
    payload: ReservationAvailabilityRequest,
    db: Session = Depends(get_db),
):
    validate_reservation_dates(payload.check_in_date, payload.check_out_date)
    available_rooms = get_available_room_options(
        db,
        payload.property_id,
        payload.check_in_date,
        payload.check_out_date,
        payload.currency,
    )

    return {
        "property_id": payload.property_id,
        "guest_id": payload.guest_id,
        "check_in_date": payload.check_in_date,
        "check_out_date": payload.check_out_date,
        "currency": payload.currency,
        "available_rooms": available_rooms,
    }


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
    validate_reservation_dates(next_check_in_date, next_check_out_date)

    reservation_rooms = (
        db.execute(select(ReservationRoom).where(ReservationRoom.booking_id == reservation.booking_id))
        .scalars()
        .all()
    )

    if reservation_rooms and (payload.booking_status or reservation.booking_status).upper() != "CANCELLED":
        available_room_options = get_available_room_options(
            db,
            reservation.property_id,
            next_check_in_date,
            next_check_out_date,
            payload.currency or reservation.currency,
            exclude_booking_id=reservation.booking_id,
        )
        available_room_rate_pairs = {(item["room_id"], item["rate_id"]) for item in available_room_options}
        for item in reservation_rooms:
            if (item.room_id, item.rate_id) not in available_room_rate_pairs:
                raise HTTPException(
                    status_code=422,
                    detail=f"Room {item.room_id} with rate plan {item.rate_id} is not available for the selected dates.",
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


@router.post("/{booking_id}/cancel", response_model=ReservationRead)
def cancel_reservation(booking_id: str, db: Session = Depends(get_db)):
    reservation = db.scalar(select(Reservation).where(Reservation.booking_id == booking_id))
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    reservation.booking_status = "CANCELLED"
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
