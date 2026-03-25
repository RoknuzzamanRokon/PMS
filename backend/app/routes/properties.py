from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Property, RatePlan, Room
from ..schemas import PropertyCreate, PropertyDetailRead, PropertyRead, PropertyUpdate
from ..utils import next_code

router = APIRouter(prefix="/api/v1/properties", tags=["properties"])


@router.get("", response_model=list[PropertyRead])
def list_properties(db: Session = Depends(get_db)):
    return db.execute(select(Property).order_by(Property.created_at.desc())).scalars().all()


@router.post("", response_model=PropertyRead)
def create_property(payload: PropertyCreate, db: Session = Depends(get_db)):
    property_id = payload.property_id or next_code(db, Property, "property_id", "PROP")
    property_obj = Property(property_id=property_id, **payload.model_dump(exclude={"property_id"}))
    db.add(property_obj)
    db.commit()
    db.refresh(property_obj)
    return property_obj


@router.patch("/{property_id}", response_model=PropertyRead)
def update_property(property_id: str, payload: PropertyUpdate, db: Session = Depends(get_db)):
    property_obj = db.scalar(select(Property).where(Property.property_id == property_id))
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(property_obj, field, value)

    db.commit()
    db.refresh(property_obj)
    return property_obj


@router.get("/{property_id}", response_model=PropertyDetailRead)
def get_property(property_id: str, db: Session = Depends(get_db)):
    property_obj = db.scalar(select(Property).where(Property.property_id == property_id))
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    rooms = (
        db.execute(
            select(Room)
            .where(Room.property_id == property_id)
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

    rate_plans_by_room: dict[str, list[RatePlan]] = {}
    for rate_plan in rate_plans:
        rate_plans_by_room.setdefault(rate_plan.room_id, []).append(rate_plan)

    room_items = []
    total_inventory = 0
    available_inventory = 0
    sold_inventory = 0
    blocked_inventory = 0
    sum_base_rate = Decimal("0")
    sum_current_rate = Decimal("0")
    status_counts = {
        "pending": 0,
        "processing": 0,
        "active": 0,
        "blocked": 0,
    }

    for room in rooms:
        room_rate_plans = rate_plans_by_room.get(room.room_id, [])
        room_total_inventory = sum(item.total_inventory for item in room_rate_plans)
        room_available_inventory = sum(item.available_inventory for item in room_rate_plans)
        room_sold_inventory = sum(item.sold_inventory for item in room_rate_plans)
        room_blocked_inventory = sum(
            1
            for item in room_rate_plans
            if item.stop_sell or item.closed_to_arrival or item.closed_to_departure
        )
        active_rate_plans = [item for item in room_rate_plans if item.status]
        current_rate = (
            min((item.base_rate for item in active_rate_plans), default=room.base_rate)
            if room_rate_plans
            else room.base_rate
        )

        if room_blocked_inventory:
            room_status = "blocked"
        elif active_rate_plans and room_available_inventory > 0:
            room_status = "active"
        elif room_rate_plans:
            room_status = "processing"
        else:
            room_status = "pending"

        status_counts[room_status] += 1
        total_inventory += room_total_inventory
        available_inventory += room_available_inventory
        sold_inventory += room_sold_inventory
        blocked_inventory += room_blocked_inventory
        sum_base_rate += room.base_rate
        sum_current_rate += current_rate

        room_items.append(
            {
                "room_id": room.room_id,
                "room_name": room.room_name,
                "room_name_lang": room.room_name_lang,
                "base_rate": room.base_rate,
                "current_rate": current_rate,
                "total_inventory": room_total_inventory,
                "available_inventory": room_available_inventory,
                "sold_inventory": room_sold_inventory,
                "blocked_inventory": room_blocked_inventory,
                "active_rate_plan_count": len(active_rate_plans),
                "status": room_status.upper(),
                "image": {
                    "available": False,
                    "message": "Coming soon",
                    "url": None,
                },
                "amenities": {
                    "available": False,
                    "message": "Coming soon",
                },
                "facilities": {
                    "available": False,
                    "message": "Coming soon",
                },
                "rate_plans": [
                    {
                        "rate_id": item.rate_id,
                        "title": item.title,
                        "supplier_name": item.supplier_name,
                        "currency": item.currency,
                        "status": item.status,
                        "base_rate": item.base_rate,
                        "current_rate": item.base_rate,
                        "total_inventory": item.total_inventory,
                        "available_inventory": item.available_inventory,
                        "sold_inventory": item.sold_inventory,
                        "stop_sell": item.stop_sell,
                        "closed_to_arrival": item.closed_to_arrival,
                        "closed_to_departure": item.closed_to_departure,
                    }
                    for item in room_rate_plans
                ],
            }
        )

    room_count = len(rooms)
    average_base_rate = (sum_base_rate / room_count) if room_count else Decimal("0")
    average_current_rate = (sum_current_rate / room_count) if room_count else Decimal("0")

    return {
        "property_id": property_obj.property_id,
        "name": property_obj.name,
        "name_lang": property_obj.name_lang,
        "property_type": property_obj.property_type,
        "created_at": property_obj.created_at,
        "updated_at": property_obj.updated_at,
        "summary": {
            "total_rooms": room_count,
            "total_rate_plans": len(rate_plans),
            "total_inventory": total_inventory,
            "available_inventory": available_inventory,
            "sold_inventory": sold_inventory,
            "blocked_inventory": blocked_inventory,
            "average_base_rate": average_base_rate,
            "average_current_rate": average_current_rate,
            "room_status_counts": status_counts,
        },
        "property_base_image": {
            "available": False,
            "message": "Coming soon",
            "url": None,
        },
        "amenities": {
            "available": False,
            "message": "Coming soon",
        },
        "facilities": {
            "available": False,
            "message": "Coming soon",
        },
        "rooms": room_items,
    }
