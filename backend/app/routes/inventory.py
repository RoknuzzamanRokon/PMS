from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Guest, Property, RateCalendar, RatePlan, Reservation, ReservationRoom, Room

UNAVAILABLE_CALENDAR_STATUSES = {"UNAVAILABLE", "SOLD_OUT", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED"}

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


@router.get("/calendar")
def inventory_calendar(
    property_id: str = Query(...),
    start_date: date | None = Query(None),
    days: int = Query(14, ge=1, le=30),
    db: Session = Depends(get_db),
):
    start = start_date or date.today()
    end = start + timedelta(days=days)
    property_obj = db.scalar(select(Property).where(Property.property_id == property_id))

    rooms = (
        db.execute(select(Room).where(Room.property_id == property_id).order_by(Room.room_name.asc()))
        .scalars()
        .all()
    )
    room_ids = [room.room_id for room in rooms]

    rate_rows = (
        db.execute(
            select(RatePlan, RateCalendar)
            .join(RateCalendar, RateCalendar.rate_id == RatePlan.rate_id)
            .where(
                RatePlan.room_id.in_(room_ids),
                RatePlan.status == 1,
                RatePlan.stop_sell == 0,
                RateCalendar.stay_date >= start,
                RateCalendar.stay_date < end,
            )
            .order_by(RatePlan.room_id.asc(), RatePlan.rate_id.asc(), RateCalendar.stay_date.asc())
        )
        .all()
        if room_ids
        else []
    )
    active_rates_by_room = {}
    for rate_plan, rate_calendar in rate_rows:
        if rate_calendar.availability in UNAVAILABLE_CALENDAR_STATUSES:
            continue
        active_rates_by_room.setdefault(rate_plan.room_id, {})
        active_rates_by_room[rate_plan.room_id][rate_plan.rate_id] = {
            "rate_id": rate_plan.rate_id,
            "title": rate_plan.title,
        }

    reservations = (
        db.execute(
            select(Reservation, ReservationRoom, Guest)
            .join(ReservationRoom, ReservationRoom.booking_id == Reservation.booking_id)
            .join(Guest, Guest.guest_id == Reservation.guest_id)
            .where(
                Reservation.property_id == property_id,
                Reservation.booking_status.not_in(["CANCELLED", "Cancelled", "cancelled"]),
                Reservation.check_out_date > start,
                Reservation.check_in_date < end,
            )
            .order_by(Reservation.check_in_date.asc())
        )
        .all()
    )

    bookings_by_room = {}
    for reservation, reservation_room, guest in reservations:
        left_days = max(0, (reservation.check_in_date - start).days)
        duration_days = max(1, (reservation.check_out_date - reservation.check_in_date).days)
        booking_status = (reservation.booking_status or "").upper()
        tone = {
            "CHECKED_IN": "green",
            "PENDING": "amber",
        }.get(booking_status, "blue")
        bookings_by_room.setdefault(reservation_room.room_id, []).append({
            "left_days": left_days,
            "duration_days": duration_days,
            "tone": tone,
            "guest_name": reservation_room.occupant_name or f"{guest.first_name} {guest.last_name}",
            "meta": f"{reservation.booking_id} • {reservation.booking_status}",
            "booking_id": reservation.booking_id,
            "booking_status": reservation.booking_status,
            "rate_id": reservation_room.rate_id,
            "check_in_date": reservation.check_in_date.isoformat(),
            "check_out_date": reservation.check_out_date.isoformat(),
        })

    rows = []
    for room in rooms:
        room_rates = list((active_rates_by_room.get(room.room_id) or {}).values())
        room_bookings = bookings_by_room.get(room.room_id, [])
        if not room_bookings:
            rows.append(
                {
                    "room_id": room.room_id,
                    "room_name": room.room_name,
                    "rate_ids": [rate["rate_id"] for rate in room_rates],
                    "rates": room_rates,
                    "booking": None,
                }
            )
            continue

        for booking in room_bookings:
            rows.append(
                {
                    "room_id": room.room_id,
                    "room_name": room.room_name,
                    "rate_ids": [rate["rate_id"] for rate in room_rates],
                    "rates": room_rates,
                    "booking": booking,
                }
            )

    return {
        "property": {
            "property_id": property_obj.property_id if property_obj else property_id,
            "name": property_obj.name if property_obj else property_id,
        },
        "start_date": start.isoformat(),
        "days": days,
        "rows": rows,
    }
