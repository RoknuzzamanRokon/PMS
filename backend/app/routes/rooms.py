from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from sqlalchemy import func

from ..models import Property, RatePlan, ReservationRoom, Room
from ..schemas import RoomCreate, RoomDetailRead, RoomRead, RoomUpdate
from ..utils import next_code


router = APIRouter(prefix="/api/v1/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomRead])
def list_rooms(property_id: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Room).order_by(Room.created_at.desc())
    if property_id:
        stmt = stmt.where(Room.property_id == property_id)
    return db.execute(stmt).scalars().all()


@router.get("/live-rooms", response_model=list[RoomRead])
def list_live_rooms(property_id: str | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(Room)
        .where(Room.room_status == "LIVE")
        .order_by(Room.created_at.desc())
    )
    if property_id:
        stmt = stmt.where(Room.property_id == property_id)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=RoomRead)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    room_id = payload.room_id or next_code(db, Room, "room_id", "ROOM")
    room = Room(room_id=room_id, **payload.model_dump(exclude={"room_id"}))
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/overview")
def rooms_overview(property_id: str, db: Session = Depends(get_db)):
    property_obj = db.scalar(select(Property).where(Property.property_id == property_id))
    rooms = (
        db.execute(select(Room).where(Room.property_id == property_id).order_by(Room.room_name.asc()))
        .scalars()
        .all()
    )
    room_ids = [room.room_id for room in rooms]
    rate_plans = (
        db.execute(select(RatePlan).where(RatePlan.room_id.in_(room_ids)).order_by(RatePlan.room_id.asc()))
        .scalars()
        .all()
    )
    reservation_rooms = (
        db.execute(select(ReservationRoom).where(ReservationRoom.room_id.in_(room_ids)))
        .scalars()
        .all()
    )

    rate_plan_by_room = {}
    for rate_plan in rate_plans:
        rate_plan_by_room.setdefault(rate_plan.room_id, []).append(rate_plan)

    reservation_count_by_room = {}
    for reservation_room in reservation_rooms:
        reservation_count_by_room[reservation_room.room_id] = reservation_count_by_room.get(reservation_room.room_id, 0) + 1

    total_inventory = sum(item.total_inventory for item in rate_plans)
    sold_inventory = sum(item.sold_inventory for item in rate_plans)
    available_inventory = sum(item.available_inventory for item in rate_plans)
    blocked_inventory = sum(1 for item in rate_plans if item.stop_sell or item.closed_to_arrival or item.closed_to_departure)
    occupancy_percent = round((sold_inventory / total_inventory) * 100, 2) if total_inventory else 0

    return {
        "property": {
            "property_id": property_obj.property_id if property_obj else property_id,
            "name": property_obj.name if property_obj else property_id,
        },
        "summary": {
            "total_rooms": len(rooms),
            "available_inventory": available_inventory,
            "sold_inventory": sold_inventory,
            "blocked_inventory": blocked_inventory,
            "occupancy_percent": occupancy_percent,
        },
        "categories": [
            {
                "room_id": room.room_id,
                "room_name": room.room_name,
                "base_rate": float(room.base_rate),
                "room_status": room.room_status,
                "rate_plan_count": len(rate_plan_by_room.get(room.room_id, [])),
                "reservation_count": reservation_count_by_room.get(room.room_id, 0),
                "available_inventory": sum(item.available_inventory for item in rate_plan_by_room.get(room.room_id, [])),
                "sold_inventory": sum(item.sold_inventory for item in rate_plan_by_room.get(room.room_id, [])),
            }
            for room in rooms
        ],
        "rooms": [
            {
                "room_id": room.room_id,
                "room_name": room.room_name,
                "property_id": room.property_id,
                "base_rate": float(room.base_rate),
                "status": room.room_status,
                "housekeeping_status": "Inspect"
                if reservation_count_by_room.get(room.room_id, 0)
                else "Ready",
                "note": f"{len(rate_plan_by_room.get(room.room_id, []))} rate plans linked",
            }
            for room in rooms
        ],
    }


@router.get("/{room_id}", response_model=RoomDetailRead)
def get_room(room_id: str, db: Session = Depends(get_db)):
    room = db.scalar(select(Room).where(Room.room_id == room_id))
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    rate_plans = (
        db.execute(
            select(RatePlan)
            .where(RatePlan.room_id == room_id)
            .order_by(RatePlan.status.desc(), RatePlan.created_at.desc())
        )
        .scalars()
        .all()
    )

    current_rate_plan = next((item for item in rate_plans if item.status), None)
    if current_rate_plan is None and rate_plans:
        current_rate_plan = rate_plans[0]

    def serialize_rate_plan(item: RatePlan):
        return {
            "rate_id": item.rate_id,
            "title": item.title,
            "supplier_name": item.supplier_name,
            "currency": item.currency,
            "status": item.status,
            "meal_plan": item.meal_plan,
            "base_rate": item.base_rate,
            "total_inventory": item.total_inventory,
            "available_inventory": item.available_inventory,
            "sold_inventory": item.sold_inventory,
            "stop_sell": item.stop_sell,
            "closed_to_arrival": item.closed_to_arrival,
            "closed_to_departure": item.closed_to_departure,
        }

    return {
        "room_id": room.room_id,
        "property_id": room.property_id,
        "room_name": room.room_name,
        "room_name_lang": room.room_name_lang,
        "room_status": room.room_status,
        "base_rate": room.base_rate,
        "tax_and_service_fee": room.tax_and_service_fee,
        "surcharges": room.surcharges,
        "mandatory_fee": room.mandatory_fee,
        "resort_fee": room.resort_fee,
        "mandatory_tax": room.mandatory_tax,
        "created_at": room.created_at,
        "updated_at": room.updated_at,
        "current_rate_plan": serialize_rate_plan(current_rate_plan) if current_rate_plan else None,
        "rate_plans": [serialize_rate_plan(item) for item in rate_plans],
    }


@router.patch("/{room_id}", response_model=RoomRead)
def update_room(room_id: str, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = db.scalar(select(Room).where(Room.room_id == room_id))
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(room, field, value)

    db.commit()
    db.refresh(room)
    return room


@router.get("/live-rooms", response_model=list[RoomRead])
def list_live_rooms(property_id: str | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(Room).where(Room.room_status == "LIVE").order_by(Room.created_at.desc())
    )
    if property_id:
        stmt = stmt.where(Room.property_id == property_id)
    return db.execute(stmt).scalars().all()
