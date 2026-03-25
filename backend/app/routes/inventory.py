from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Guest, Property, Reservation, ReservationRoom, Room

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

    reservations = (
        db.execute(
            select(Reservation, ReservationRoom, Guest)
            .join(ReservationRoom, ReservationRoom.booking_id == Reservation.booking_id)
            .join(Guest, Guest.guest_id == Reservation.guest_id)
            .where(
                Reservation.property_id == property_id,
                Reservation.check_out_date > start,
                Reservation.check_in_date < end,
            )
            .order_by(Reservation.check_in_date.asc())
        )
        .all()
    )

    booking_by_room = {}
    for reservation, reservation_room, guest in reservations:
        left_days = max(0, (reservation.check_in_date - start).days)
        duration_days = max(1, (reservation.check_out_date - reservation.check_in_date).days)
        booking_status = (reservation.booking_status or "").upper()
        tone = {
            "CHECKED_IN": "green",
            "PENDING": "amber",
        }.get(booking_status, "blue")
        booking_by_room[reservation_room.room_id] = {
            "left_days": left_days,
            "duration_days": duration_days,
            "tone": tone,
            "guest_name": f"{guest.first_name} {guest.last_name}",
            "meta": f"{reservation.booking_id} • {reservation.booking_status}",
            "booking_id": reservation.booking_id,
            "booking_status": reservation.booking_status,
            "check_in_date": reservation.check_in_date.isoformat(),
            "check_out_date": reservation.check_out_date.isoformat(),
        }

    rows = [
        {
            "room_id": room.room_id,
            "room_name": room.room_name,
            "booking": booking_by_room.get(room.room_id),
        }
        for room in rooms
    ]

    return {
        "property": {
            "property_id": property_obj.property_id if property_obj else property_id,
            "name": property_obj.name if property_obj else property_id,
        },
        "start_date": start.isoformat(),
        "days": days,
        "rows": rows,
    }
