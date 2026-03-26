from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    ReservationAvailabilityRequest,
    ReservationAvailabilityResponse,
)
from .reservations import get_available_room_options, validate_reservation_dates

router = APIRouter(prefix="/api/v1/available-rooms", tags=["available-rooms"])


@router.post("", response_model=ReservationAvailabilityResponse)
def list_available_rooms(
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
