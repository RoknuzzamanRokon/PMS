from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RateCalendar, RatePlan
from ..schemas import CalendarBulkUpsertRequest, CalendarItemRead, RatePlanCreate, RatePlanRead
from ..utils import next_code

router = APIRouter(prefix="/api/v1/rate-plans", tags=["rate-plans"])


@router.get("", response_model=list[RatePlanRead])
def list_rate_plans(room_id: str | None = None, db: Session = Depends(get_db)):
    stmt = select(RatePlan).order_by(RatePlan.created_at.desc())
    if room_id:
        stmt = stmt.where(RatePlan.room_id == room_id)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=RatePlanRead)
def create_rate_plan(payload: RatePlanCreate, db: Session = Depends(get_db)):
    rate_id = payload.rate_id or next_code(db, RatePlan, "rate_id", "RATE")
    rate_plan = RatePlan(
        rate_id=rate_id,
        **payload.model_dump(
            exclude={
                "rate_id",
                "is_refundable",
                "status",
                "closed_to_arrival",
                "closed_to_departure",
                "stop_sell",
            }
        ),
        is_refundable=int(payload.is_refundable),
        status=int(payload.status),
        closed_to_arrival=int(payload.closed_to_arrival),
        closed_to_departure=int(payload.closed_to_departure),
        stop_sell=int(payload.stop_sell),
    )
    db.add(rate_plan)
    db.commit()
    db.refresh(rate_plan)
    return rate_plan


@router.get("/{rate_id}", response_model=RatePlanRead)
def get_rate_plan(rate_id: str, db: Session = Depends(get_db)):
    rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == rate_id))
    if not rate_plan:
        raise HTTPException(status_code=404, detail="Rate plan not found")
    return rate_plan


@router.post("/{rate_id}/calendar/bulk-upsert")
def bulk_upsert_rate_calendar(
    rate_id: str,
    payload: CalendarBulkUpsertRequest,
    db: Session = Depends(get_db),
):
    rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == rate_id))
    if not rate_plan:
        raise HTTPException(status_code=404, detail="Rate plan not found")

    updated = 0
    created = 0
    for item in payload.items:
        existing = db.scalar(
            select(RateCalendar).where(
                RateCalendar.rate_id == rate_id,
                RateCalendar.stay_date == item.stay_date,
            )
        )
        if existing:
            existing.currency = item.currency
            existing.base_rate = item.base_rate
            existing.tax = item.tax
            existing.availability = item.availability
            updated += 1
        else:
            db.add(RateCalendar(rate_id=rate_id, **item.model_dump()))
            created += 1

    db.commit()
    return {"rate_id": rate_id, "created": created, "updated": updated}


@router.get("/{rate_id}/calendar", response_model=list[CalendarItemRead])
def get_rate_calendar(
    rate_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(RateCalendar).where(RateCalendar.rate_id == rate_id).order_by(RateCalendar.stay_date.asc())
    if start_date:
        stmt = stmt.where(RateCalendar.stay_date >= start_date)
    if end_date:
        stmt = stmt.where(RateCalendar.stay_date <= end_date)
    return db.execute(stmt).scalars().all()
