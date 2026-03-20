from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RateCalendar, RatePlan, Room
from ..schemas import AvailabilitySearchResponse

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("/availability", response_model=AvailabilitySearchResponse)
def search_availability(
    property_id: str = Query(...),
    check_in_date: date = Query(...),
    check_out_date: date = Query(...),
    db: Session = Depends(get_db),
):
    room_ids = db.execute(select(Room.room_id).where(Room.property_id == property_id)).scalars().all()
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
        if any(item.availability == "SOLD_OUT" for item in calendars):
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
