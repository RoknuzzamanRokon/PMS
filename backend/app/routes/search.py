from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RateCalendar, RatePlan, Room
from ..schemas import AvailabilityDatesResponse, AvailabilitySearchResponse
from .reservations import get_available_room_options

router = APIRouter(prefix="/api/v1/search", tags=["search"])

UNAVAILABLE_CALENDAR_STATUSES = {"SOLD_OUT", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED"}


@router.get("/availability", response_model=AvailabilitySearchResponse)
def search_availability(
    property_id: str = Query(...),
    check_in_date: date = Query(...),
    check_out_date: date = Query(...),
    db: Session = Depends(get_db),
):
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

    room_ids = db.execute(select(Room.room_id).where(Room.property_id == property_id)).scalars().all()
    requested_nights = (check_out_date - check_in_date).days
    rate_plans = (
        db.execute(select(RatePlan).where(RatePlan.room_id.in_(room_ids)).order_by(RatePlan.base_rate.asc()))
        .scalars()
        .all()
    )

    available_rate_plans = []
    for rate_plan in rate_plans:
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
        if not calendars:
            continue
        if (
            not rate_plan.status
            or rate_plan.available_inventory <= 0
            or rate_plan.stop_sell
            or rate_plan.closed_to_arrival
            or rate_plan.closed_to_departure
        ):
            continue
        if requested_nights < rate_plan.min_stay or requested_nights > rate_plan.max_stay:
            continue
        if len(calendars) != requested_nights:
            continue
        calendar_dates = {item.stay_date for item in calendars}
        expected_dates = {check_in_date + timedelta(days=offset) for offset in range(requested_nights)}
        if calendar_dates != expected_dates:
            continue
        if any(item.availability in UNAVAILABLE_CALENDAR_STATUSES for item in calendars):
            continue
        average_rate = sum(Decimal(item.base_rate) for item in calendars) / Decimal(len(calendars))
        available_rate_plans.append(
            {
                "rate_id": rate_plan.rate_id,
                "room_id": rate_plan.room_id,
                "title": rate_plan.title,
                "currency": rate_plan.currency,
                "average_rate": average_rate,
                "nights": len(calendars),
                "available_inventory": rate_plan.available_inventory,
            }
        )

    return AvailabilitySearchResponse(
        property_id=property_id,
        check_in_date=check_in_date,
        check_out_date=check_out_date,
        available_rate_plans=available_rate_plans,
    )


@router.get("/available-dates", response_model=AvailabilityDatesResponse)
def search_available_dates(
    property_id: str = Query(...),
    start_date: date | None = Query(None),
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
):
    today = date.today()
    requested_start = start_date or today
    start = max(requested_start, today)
    end = start + timedelta(days=days - 1)

    available_dates = []
    current = start
    while current <= end:
        next_date = current + timedelta(days=1)
        available_rooms = get_available_room_options(
            db,
            property_id,
            current,
            next_date,
            "USD",
        )
        if available_rooms:
            available_dates.append(
                {
                    "stay_date": current,
                    "available_room_count": len({item["room_id"] for item in available_rooms}),
                    "available_rate_plan_count": len({item["rate_id"] for item in available_rooms}),
                    "room_ids": sorted({item["room_id"] for item in available_rooms}),
                    "rate_ids": sorted({item["rate_id"] for item in available_rooms}),
                }
            )
        current = next_date

    return AvailabilityDatesResponse(
        property_id=property_id,
        start_date=start,
        end_date=end,
        available_dates=available_dates,
    )
