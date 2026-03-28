from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Room, RoomInventoryCalendar
from ..schemas import (
    PropertyInventoryCalendarResponse,
    PropertyInventoryDayDetail,
    RoomInventoryBulkUpsertRequest,
    RoomInventoryBulkUpsertResponse,
)
from ..services.inventory import LIVE_ROOM_STATUS, calculate_available_inventory, property_inventory_summary_for_dates

router = APIRouter(tags=["room-inventory"])


def _iter_dates(start_date: date, end_date: date):
    total_days = (end_date - start_date).days + 1
    for offset in range(total_days):
        yield start_date + timedelta(days=offset)


@router.post("/api/v1/rooms/{room_id}/inventory-calendar/bulk-upsert", response_model=RoomInventoryBulkUpsertResponse)
def bulk_upsert_room_inventory(
    room_id: str,
    payload: RoomInventoryBulkUpsertRequest,
    db: Session = Depends(get_db),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="end_date must be the same as or later than start_date.")

    room = db.scalar(select(Room).where(Room.room_id == room_id))
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if payload.is_live and str(room.room_status or "").upper() != LIVE_ROOM_STATUS:
        raise HTTPException(
            status_code=409,
            detail=f"Room {room_id} is not linked to a live room. Daily inventory can be activated only for live rooms.",
        )

    created = 0
    updated = 0
    for stay_date in _iter_dates(payload.start_date, payload.end_date):
        existing = db.scalar(
            select(RoomInventoryCalendar).where(
                RoomInventoryCalendar.room_id == room_id,
                RoomInventoryCalendar.stay_date == stay_date,
            )
        )
        is_live = int(payload.is_live)
        if existing:
            existing.property_id = room.property_id
            existing.is_live = is_live
            existing.total_inventory = payload.total_inventory
            existing.blocked_inventory = payload.blocked_inventory
            existing.available_inventory = calculate_available_inventory(
                existing.total_inventory,
                existing.booked_inventory,
                existing.blocked_inventory,
                existing.is_live,
            )
            updated += 1
        else:
            db.add(
                RoomInventoryCalendar(
                    property_id=room.property_id,
                    room_id=room_id,
                    stay_date=stay_date,
                    is_live=is_live,
                    total_inventory=payload.total_inventory,
                    booked_inventory=0,
                    blocked_inventory=payload.blocked_inventory,
                    available_inventory=calculate_available_inventory(
                        payload.total_inventory,
                        0,
                        payload.blocked_inventory,
                        is_live,
                    ),
                )
            )
            created += 1

    db.commit()
    return {
        "room_id": room_id,
        "property_id": room.property_id,
        "created": created,
        "updated": updated,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
    }


@router.get("/api/v1/properties/{property_id}/inventory-calendar", response_model=PropertyInventoryCalendarResponse)
def get_property_inventory_calendar(
    property_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be the same as or later than start_date.")

    return {
        "property_id": property_id,
        "start_date": start_date,
        "end_date": end_date,
        "dates": property_inventory_summary_for_dates(db, property_id, start_date, end_date),
    }


@router.get("/api/v1/properties/{property_id}/inventory-calendar/{stay_date}", response_model=PropertyInventoryDayDetail)
def get_property_inventory_day_detail(
    property_id: str,
    stay_date: date,
    db: Session = Depends(get_db),
):
    rows = (
        db.execute(
            select(RoomInventoryCalendar)
            .where(
                RoomInventoryCalendar.property_id == property_id,
                RoomInventoryCalendar.stay_date == stay_date,
            )
            .order_by(RoomInventoryCalendar.room_id.asc())
        )
        .scalars()
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No inventory found for the requested property/date.")

    summary = property_inventory_summary_for_dates(db, property_id, stay_date, stay_date)[0]
    return {
        **summary,
        "rooms": rows,
    }
