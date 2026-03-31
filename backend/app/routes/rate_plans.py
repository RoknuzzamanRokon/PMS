from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    AvailabilityStatus,
    Property,
    RateCalendar,
    RateCancellationPolicy,
    RatePlan,
    Reservation,
    ReservationRoom,
    Room,
    RoomInventoryCalendar,
)
from ..schemas import (
    AvailabilityStatusRead,
    CalendarBulkUpsertRequest,
    CalendarItemRead,
    RatePlanCreate,
    RatePlanRead,
    RatePlanUpdate,
)
from ..utils import next_code

router = APIRouter(prefix="/api/v1/rate-plans", tags=["rate-plans"])
LIVE_ROOM_STATUS = "LIVE"
HARD_BOOKING_STATUSES = {"CONFIRMED", "CHECKED_IN"}


def _ensure_availability_status_code(db: Session, availability_code: str | None) -> str:
    code = str(availability_code or "AVAILABLE").strip().upper()
    existing = db.scalar(select(AvailabilityStatus).where(AvailabilityStatus.code == code))
    if existing:
        return code

    db.add(
        AvailabilityStatus(
            code=code,
            title=code.replace("-", " ").replace("_", " "),
            description=f"Auto-created status for rate calendar availability: {code}.",
        )
    )
    db.flush()
    return code


def _get_live_room_or_409(db: Session, room_id: str) -> Room:
    room = db.scalar(select(Room).where(Room.room_id == room_id))
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if str(room.room_status or "").upper() != LIVE_ROOM_STATUS:
        raise HTTPException(
            status_code=409,
            detail=f"Room {room_id} is not linked to a live room. Rate plans and calendars are allowed only for live rooms.",
        )
    return room


def _get_live_rate_plan_or_409(db: Session, rate_id: str) -> RatePlan:
    rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == rate_id))
    if not rate_plan:
        raise HTTPException(status_code=404, detail="Rate plan not found")
    _get_live_room_or_409(db, rate_plan.room_id)
    return rate_plan


def _next_room_inventory_calendar_id(db: Session) -> int:
    return int(db.scalar(select(func.coalesce(func.max(RoomInventoryCalendar.id), 0))) or 0) + 1


def _ensure_room_inventory_calendar_rows(
    db: Session,
    room: Room,
    stay_dates: list[date],
) -> int:
    if not stay_dates:
        return 0

    existing_rows = (
        db.execute(
            select(RoomInventoryCalendar).where(
                RoomInventoryCalendar.room_id == room.room_id,
                RoomInventoryCalendar.stay_date.in_(stay_dates),
            )
        )
        .scalars()
        .all()
    )
    existing_by_date = {row.stay_date: row for row in existing_rows}
    next_id = _next_room_inventory_calendar_id(db)
    created = 0

    for stay_date in stay_dates:
        row = existing_by_date.get(stay_date)
        if row:
            row.property_id = room.property_id
            row.is_live = 1 if str(room.room_status or "").upper() == LIVE_ROOM_STATUS else 0
            row.available_inventory = max(row.total_inventory - row.booked_inventory - row.blocked_inventory, 0) if row.is_live else 0
            continue

        total_inventory = 1
        booked_inventory = 0
        blocked_inventory = 0
        is_live = 1 if str(room.room_status or "").upper() == LIVE_ROOM_STATUS else 0
        available_inventory = max(total_inventory - booked_inventory - blocked_inventory, 0) if is_live else 0
        db.add(
            RoomInventoryCalendar(
                id=next_id,
                property_id=room.property_id,
                room_id=room.room_id,
                stay_date=stay_date,
                is_live=is_live,
                total_inventory=total_inventory,
                booked_inventory=booked_inventory,
                blocked_inventory=blocked_inventory,
                available_inventory=available_inventory,
            )
        )
        next_id += 1
        created += 1

    db.flush()
    return created


@router.get("/availability-statuses", response_model=list[AvailabilityStatusRead])
def list_availability_statuses(db: Session = Depends(get_db)):
    return db.execute(select(AvailabilityStatus).order_by(AvailabilityStatus.id.asc())).scalars().all()


@router.get("/daily-rates")
def daily_rates_matrix(
    property_id: str = Query(...),
    start_date: date | None = Query(None),
    days: int = Query(30, ge=1, le=30),
    db: Session = Depends(get_db),
):
    start = start_date or date.today()
    end = start + timedelta(days=days - 1)

    property_obj = db.scalar(select(Property).where(Property.property_id == property_id))

    rooms = (
        db.execute(
            select(Room)
            .where(
                Room.property_id == property_id,
                func.upper(func.coalesce(Room.room_status, "")) == LIVE_ROOM_STATUS,
            )
            .order_by(Room.room_name.asc())
        )
        .scalars()
        .all()
    )
    room_ids = [room.room_id for room in rooms]

    rate_plans = (
        db.execute(
            select(RatePlan)
            .where(RatePlan.room_id.in_(room_ids))
            .order_by(RatePlan.room_id.asc(), RatePlan.created_at.desc())
        )
        .scalars()
        .all()
        if room_ids
        else []
    )
    rate_plan_by_id = {rate_plan.rate_id: rate_plan for rate_plan in rate_plans}
    rate_ids = [rate_plan.rate_id for rate_plan in rate_plans]

    calendars = (
        db.execute(
            select(RateCalendar)
            .where(
                RateCalendar.rate_id.in_(rate_ids),
                RateCalendar.stay_date >= start,
                RateCalendar.stay_date <= end,
            )
            .order_by(RateCalendar.rate_id.asc(), RateCalendar.stay_date.asc())
        )
        .scalars()
        .all()
        if rate_ids
        else []
    )

    booked_rate_dates: dict[tuple[str, str], dict] = {}
    hard_booked_room_dates: set[tuple[str, str]] = set()
    reservations = (
        db.execute(
            select(Reservation, ReservationRoom)
            .join(ReservationRoom, ReservationRoom.booking_id == Reservation.booking_id)
            .where(
                Reservation.property_id == property_id,
                ReservationRoom.rate_id.in_(rate_ids),
                Reservation.booking_status.not_in(["CANCELLED", "Cancelled", "cancelled"]),
                Reservation.check_out_date > start,
                Reservation.check_in_date <= end,
            )
        )
        .all()
        if rate_ids
        else []
    )
    for reservation, reservation_room in reservations:
        current = max(reservation.check_in_date, start)
        stay_end = min(reservation.check_out_date, end + timedelta(days=1))
        while current < stay_end:
            stay_date = current.isoformat()
            booking_status = reservation.booking_status
            booked_rate_dates[(reservation_room.rate_id, stay_date)] = {
                "booking_id": reservation.booking_id,
                "booking_status": booking_status,
            }
            if str(booking_status or "").upper() in HARD_BOOKING_STATUSES:
                hard_booked_room_dates.add((reservation_room.room_id, stay_date))
            current += timedelta(days=1)

    calendar_by_rate_id: dict[str, list[dict]] = {}
    for item in calendars:
        stay_date = item.stay_date.isoformat()
        booking = booked_rate_dates.get((item.rate_id, stay_date))
        rate_plan = rate_plan_by_id.get(item.rate_id)
        booking_status = str(booking["booking_status"] or "").upper() if booking else ""
        availability = item.availability
        if booking:
            availability = "BOOKED" if booking_status in HARD_BOOKING_STATUSES else "PROSSING"
        elif rate_plan and (rate_plan.room_id, stay_date) in hard_booked_room_dates:
            availability = "AB-UNAVAILABLE"
        calendar_by_rate_id.setdefault(item.rate_id, []).append(
            {
                "stay_date": stay_date,
                "currency": item.currency,
                "base_rate": item.base_rate,
                "tax": item.tax,
                "availability": availability,
                "booking_id": booking["booking_id"] if booking else None,
                "booking_status": booking["booking_status"] if booking else None,
            }
        )

    return {
        "property": {
            "property_id": property_obj.property_id if property_obj else property_id,
            "name": property_obj.name if property_obj else property_id,
        },
        "start_date": start.isoformat(),
        "days": days,
        "rooms": [
            {
                "room_id": room.room_id,
                "property_id": room.property_id,
                "room_name": room.room_name,
                "room_name_lang": room.room_name_lang,
                "room_status": room.room_status,
                "base_rate": room.base_rate,
                "tax_and_service_fee": room.tax_and_service_fee,
            }
            for room in rooms
        ],
        "rate_plans": [
            {
                "rate_id": rate_plan.rate_id,
                "room_id": rate_plan.room_id,
                "title": rate_plan.title,
                "description": rate_plan.description,
                "meal_plan": rate_plan.meal_plan,
                "currency": rate_plan.currency,
                "base_rate": rate_plan.base_rate,
                "total_inventory": rate_plan.total_inventory,
                "available_inventory": rate_plan.available_inventory,
                "sold_inventory": rate_plan.sold_inventory,
                "closed_to_arrival": rate_plan.closed_to_arrival,
                "closed_to_departure": rate_plan.closed_to_departure,
                "stop_sell": rate_plan.stop_sell,
                "cancellation_policy": rate_plan.cancellation_policy,
                "calendar": calendar_by_rate_id.get(rate_plan.rate_id, []),
            }
            for rate_plan in rate_plans
        ],
    }


@router.get("", response_model=list[RatePlanRead])
def list_rate_plans(room_id: str | None = None, db: Session = Depends(get_db)):
    stmt = select(RatePlan).order_by(RatePlan.created_at.desc())
    if room_id:
        stmt = stmt.where(RatePlan.room_id == room_id)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=RatePlanRead)
def create_rate_plan(payload: RatePlanCreate, db: Session = Depends(get_db)):
    _get_live_room_or_409(db, payload.room_id)
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
    return _get_live_rate_plan_or_409(db, rate_id)


@router.patch("/{rate_id}", response_model=RatePlanRead)
def update_rate_plan(rate_id: str, payload: RatePlanUpdate, db: Session = Depends(get_db)):
    rate_plan = _get_live_rate_plan_or_409(db, rate_id)

    updates = payload.model_dump(exclude_unset=True)
    bool_fields = {"is_refundable", "status", "closed_to_arrival", "closed_to_departure", "stop_sell"}
    target_room_id = updates.get("room_id") or rate_plan.room_id
    _get_live_room_or_409(db, target_room_id)

    for field, value in updates.items():
        if field in bool_fields and value is not None:
            setattr(rate_plan, field, int(value))
        else:
            setattr(rate_plan, field, value)

    db.commit()
    db.refresh(rate_plan)
    return rate_plan


@router.delete("/{rate_id}")
def delete_rate_plan(rate_id: str, db: Session = Depends(get_db)):
    rate_plan = _get_live_rate_plan_or_409(db, rate_id)

    linked_reservation = db.scalar(select(ReservationRoom.id).where(ReservationRoom.rate_id == rate_id).limit(1))
    if linked_reservation:
        raise HTTPException(
            status_code=409,
            detail="Rate plan is linked to reservations and cannot be removed.",
        )

    deleted_calendar_rows = db.execute(
        delete(RateCalendar).where(RateCalendar.rate_id == rate_id)
    ).rowcount or 0
    deleted_policy_rows = db.execute(
        delete(RateCancellationPolicy).where(RateCancellationPolicy.rate_id == rate_id)
    ).rowcount or 0

    db.delete(rate_plan)
    db.commit()

    return {
        "rate_id": rate_id,
        "room_id": rate_plan.room_id,
        "deleted_calendar_rows": deleted_calendar_rows,
        "deleted_policy_rows": deleted_policy_rows,
    }


@router.post("/{rate_id}/calendar/bulk-upsert")
def bulk_upsert_rate_calendar(
    rate_id: str,
    payload: CalendarBulkUpsertRequest,
    db: Session = Depends(get_db),
):
    rate_plan = _get_live_rate_plan_or_409(db, rate_id)
    room = _get_live_room_or_409(db, rate_plan.room_id)

    updated = 0
    created = 0
    room_inventory_created = 0
    stay_dates = [item.stay_date for item in payload.items]
    room_inventory_created = _ensure_room_inventory_calendar_rows(db, room, stay_dates)
    for item in payload.items:
        availability_code = _ensure_availability_status_code(db, item.availability)
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
            existing.availability = availability_code
            updated += 1
        else:
            payload_data = item.model_dump()
            payload_data["availability"] = availability_code
            db.add(RateCalendar(rate_id=rate_id, **payload_data))
            created += 1

    db.commit()
    return {
        "rate_id": rate_id,
        "room_id": room.room_id,
        "created": created,
        "updated": updated,
        "room_inventory_created": room_inventory_created,
    }


@router.get("/{rate_id}/calendar", response_model=list[CalendarItemRead])
def get_rate_calendar(
    rate_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    _get_live_rate_plan_or_409(db, rate_id)
    stmt = select(RateCalendar).where(RateCalendar.rate_id == rate_id).order_by(RateCalendar.stay_date.asc())
    if start_date:
        stmt = stmt.where(RateCalendar.stay_date >= start_date)
    if end_date:
        stmt = stmt.where(RateCalendar.stay_date <= end_date)
    return db.execute(stmt).scalars().all()
