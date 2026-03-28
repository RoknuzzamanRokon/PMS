from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import RateCalendar, RatePlan, Reservation, ReservationRoom, Room, RoomInventoryCalendar

LIVE_ROOM_STATUS = "LIVE"
UNAVAILABLE_CALENDAR_STATUSES = {"SOLD_OUT", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED"}
INACTIVE_BOOKING_STATUSES = {"CANCELLED"}


def daterange(start_date: date, end_date: date) -> list[date]:
    if end_date <= start_date:
        return []
    total_days = (end_date - start_date).days
    return [start_date + timedelta(days=offset) for offset in range(total_days)]


def calculate_available_inventory(total_inventory: int, booked_inventory: int, blocked_inventory: int, is_live: int) -> int:
    if not is_live:
        return 0
    return max(total_inventory - booked_inventory - blocked_inventory, 0)


def get_room_inventory_rows(
    db: Session,
    room_id: str,
    start_date: date,
    end_date: date,
) -> list[RoomInventoryCalendar]:
    return (
        db.execute(
            select(RoomInventoryCalendar)
            .where(
                RoomInventoryCalendar.room_id == room_id,
                RoomInventoryCalendar.stay_date >= start_date,
                RoomInventoryCalendar.stay_date < end_date,
            )
            .order_by(RoomInventoryCalendar.stay_date.asc())
        )
        .scalars()
        .all()
    )


def validate_room_inventory_window(
    db: Session,
    room: Room,
    start_date: date,
    end_date: date,
) -> list[RoomInventoryCalendar]:
    expected_dates = daterange(start_date, end_date)
    inventory_rows = get_room_inventory_rows(db, room.room_id, start_date, end_date)
    if len(inventory_rows) != len(expected_dates):
        return []

    inventory_by_date = {item.stay_date: item for item in inventory_rows}
    validated_rows: list[RoomInventoryCalendar] = []
    for stay_date in expected_dates:
        row = inventory_by_date.get(stay_date)
        if not row:
            return []
        if not row.is_live:
            return []
        if calculate_available_inventory(row.total_inventory, row.booked_inventory, row.blocked_inventory, row.is_live) <= 0:
            return []
        validated_rows.append(row)

    return validated_rows


def get_excluded_booking_usage(
    db: Session,
    exclude_booking_id: str | None,
    start_date: date,
    end_date: date,
) -> dict[tuple[str, date], int]:
    if not exclude_booking_id:
        return {}

    reservation = db.scalar(select(Reservation).where(Reservation.booking_id == exclude_booking_id))
    if not reservation:
        return {}
    if (reservation.booking_status or "").upper() in INACTIVE_BOOKING_STATUSES:
        return {}

    excluded_dates = daterange(max(start_date, reservation.check_in_date), min(end_date, reservation.check_out_date))
    if not excluded_dates:
        return {}

    reservation_rooms = (
        db.execute(select(ReservationRoom).where(ReservationRoom.booking_id == exclude_booking_id))
        .scalars()
        .all()
    )

    usage_counts: dict[tuple[str, date], int] = defaultdict(int)
    for room in reservation_rooms:
        for stay_date in excluded_dates:
            usage_counts[(room.room_id, stay_date)] += 1
    return usage_counts


def get_sellable_rate_options(
    db: Session,
    property_id: str,
    check_in_date: date,
    check_out_date: date,
    exclude_booking_id: str | None = None,
) -> list[dict]:
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
    if not rooms:
        return []

    total_nights = (check_out_date - check_in_date).days
    expected_dates = set(daterange(check_in_date, check_out_date))
    excluded_usage = get_excluded_booking_usage(db, exclude_booking_id, check_in_date, check_out_date)

    eligible_rooms: dict[str, tuple[Room, list[RoomInventoryCalendar]]] = {}
    for room in rooms:
        inventory_rows = get_room_inventory_rows(db, room.room_id, check_in_date, check_out_date)
        if len(inventory_rows) != total_nights:
            continue

        inventory_by_date = {row.stay_date: row for row in inventory_rows}
        is_room_sellable = True
        validated_rows: list[RoomInventoryCalendar] = []
        for stay_date in expected_dates:
            row = inventory_by_date.get(stay_date)
            if not row or not row.is_live:
                is_room_sellable = False
                break

            effective_available = calculate_available_inventory(
                row.total_inventory,
                row.booked_inventory,
                row.blocked_inventory,
                row.is_live,
            ) + excluded_usage.get((room.room_id, stay_date), 0)
            if effective_available <= 0:
                is_room_sellable = False
                break
            validated_rows.append(row)

        if is_room_sellable:
            eligible_rooms[room.room_id] = (room, validated_rows)

    if not eligible_rooms:
        return []

    rate_plans = (
        db.execute(
            select(RatePlan)
            .where(RatePlan.room_id.in_(eligible_rooms.keys()))
            .order_by(RatePlan.room_id.asc(), RatePlan.base_rate.asc(), RatePlan.created_at.asc())
        )
        .scalars()
        .all()
    )

    available_options: list[dict] = []
    for rate_plan in rate_plans:
        room_entry = eligible_rooms.get(rate_plan.room_id)
        if not room_entry:
            continue
        if not rate_plan.status:
            continue
        if rate_plan.stop_sell or rate_plan.closed_to_arrival or rate_plan.closed_to_departure:
            continue
        if total_nights < rate_plan.min_stay or total_nights > rate_plan.max_stay:
            continue

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
        if len(calendars) != total_nights:
            continue
        if {item.stay_date for item in calendars} != expected_dates:
            continue
        if any(item.availability in UNAVAILABLE_CALENDAR_STATUSES for item in calendars):
            continue

        room, _ = room_entry
        nightly_base_total = sum(item.base_rate for item in calendars)
        nightly_tax_total = sum(item.tax for item in calendars)
        total_price = nightly_base_total + nightly_tax_total
        available_options.append(
            {
                "room_id": room.room_id,
                "room_name": room.room_name,
                "room_name_lang": room.room_name_lang,
                "room_status": room.room_status,
                "rate_id": rate_plan.rate_id,
                "rate_title": rate_plan.title,
                "meal_plan": rate_plan.meal_plan,
                "currency": rate_plan.currency,
                "base_rate": nightly_base_total / total_nights,
                "tax_and_service_fee": nightly_tax_total / total_nights,
                "total_nights": total_nights,
                "total_price": total_price,
            }
        )

    return available_options


def adjust_reservation_inventory(
    db: Session,
    reservation: Reservation,
    delta: int,
) -> None:
    if (reservation.booking_status or "").upper() in INACTIVE_BOOKING_STATUSES:
        return

    stay_dates = daterange(reservation.check_in_date, reservation.check_out_date)
    if not stay_dates:
        return

    reservation_rooms = (
        db.execute(select(ReservationRoom).where(ReservationRoom.booking_id == reservation.booking_id))
        .scalars()
        .all()
    )

    for reservation_room in reservation_rooms:
        inventory_rows = (
            db.execute(
                select(RoomInventoryCalendar).where(
                    RoomInventoryCalendar.room_id == reservation_room.room_id,
                    RoomInventoryCalendar.stay_date.in_(stay_dates),
                )
            )
            .scalars()
            .all()
        )
        inventory_by_date = {row.stay_date: row for row in inventory_rows}

        for stay_date in stay_dates:
            row = inventory_by_date.get(stay_date)
            if not row:
                raise HTTPException(
                    status_code=409,
                    detail=f"Room {reservation_room.room_id} has no inventory configured for {stay_date.isoformat()}.",
                )
            next_booked = row.booked_inventory + delta
            if next_booked < 0:
                next_booked = 0
            if delta > 0 and next_booked > row.total_inventory - row.blocked_inventory:
                raise HTTPException(
                    status_code=409,
                    detail=f"Room {reservation_room.room_id} is sold out for {stay_date.isoformat()}.",
                )
            row.booked_inventory = next_booked
            row.available_inventory = calculate_available_inventory(
                row.total_inventory,
                row.booked_inventory,
                row.blocked_inventory,
                row.is_live,
            )


def property_inventory_summary_for_dates(
    db: Session,
    property_id: str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    live_rooms = (
        db.execute(
            select(Room)
            .where(
                Room.property_id == property_id,
                func.upper(func.coalesce(Room.room_status, "")) == LIVE_ROOM_STATUS,
            )
            .order_by(Room.room_id.asc())
        )
        .scalars()
        .all()
    )
    live_room_ids = [room.room_id for room in live_rooms]

    inventory_rows = (
        db.execute(
            select(RoomInventoryCalendar)
            .where(
                RoomInventoryCalendar.property_id == property_id,
                RoomInventoryCalendar.stay_date >= start_date,
                RoomInventoryCalendar.stay_date <= end_date,
            )
            .order_by(RoomInventoryCalendar.stay_date.asc(), RoomInventoryCalendar.room_id.asc())
        )
        .scalars()
        .all()
    )
    inventory_by_room_date = {(row.room_id, row.stay_date): row for row in inventory_rows}

    rates = (
        db.execute(
            select(RatePlan, RateCalendar)
            .join(Room, Room.room_id == RatePlan.room_id)
            .join(
                RateCalendar,
                RateCalendar.rate_id == RatePlan.rate_id,
            )
            .where(
                Room.property_id == property_id,
                func.upper(func.coalesce(Room.room_status, "")) == LIVE_ROOM_STATUS,
                RatePlan.status == 1,
                RateCalendar.stay_date >= start_date,
                RateCalendar.stay_date <= end_date,
            )
            .order_by(RateCalendar.stay_date.asc(), RatePlan.rate_id.asc())
        )
        .all()
    )

    rate_ids_by_date: dict[date, set[str]] = defaultdict(set)
    for rate_plan, rate_calendar in rates:
        if rate_plan.stop_sell or rate_plan.closed_to_arrival or rate_plan.closed_to_departure:
            continue
        if rate_calendar.availability in UNAVAILABLE_CALENDAR_STATUSES:
            continue
        inventory_row = inventory_by_room_date.get((rate_plan.room_id, rate_calendar.stay_date))
        if inventory_row and not inventory_row.is_live:
            continue
        rate_ids_by_date[rate_calendar.stay_date].add(rate_plan.rate_id)

    booked_room_ids_by_date: dict[date, set[str]] = defaultdict(set)
    if live_room_ids:
        reservations = (
            db.execute(
                select(ReservationRoom.room_id, Reservation.check_in_date, Reservation.check_out_date)
                .join(Reservation, Reservation.booking_id == ReservationRoom.booking_id)
                .where(
                    Reservation.property_id == property_id,
                    ReservationRoom.room_id.in_(live_room_ids),
                    Reservation.booking_status.not_in(["CANCELLED", "Cancelled", "cancelled"]),
                    Reservation.check_out_date > start_date,
                    Reservation.check_in_date <= end_date,
                )
            )
            .all()
        )
        for room_id, check_in_date, check_out_date in reservations:
            current = max(check_in_date, start_date)
            stay_end = min(check_out_date, end_date + timedelta(days=1))
            while current < stay_end:
                booked_room_ids_by_date[current].add(room_id)
                current += timedelta(days=1)

    rooms_by_date: dict[date, list[RoomInventoryCalendar]] = defaultdict(list)
    for row in inventory_rows:
        rooms_by_date[row.stay_date].append(row)

    summaries: list[dict] = []
    current_date = start_date
    while current_date <= end_date:
        active_room = 0
        booked_room = 0
        available_room = 0
        room_ids: list[str] = []
        booked_room_ids = booked_room_ids_by_date.get(current_date, set())

        for room in live_rooms:
            inventory_row = inventory_by_room_date.get((room.room_id, current_date))
            if inventory_row:
                if not inventory_row.is_live:
                    continue
                active_room += 1
                room_ids.append(room.room_id)
                if inventory_row.booked_inventory > 0:
                    booked_room += 1
                if inventory_row.available_inventory > 0:
                    available_room += 1
                continue

            active_room += 1
            room_ids.append(room.room_id)
            if room.room_id in booked_room_ids:
                booked_room += 1
            else:
                available_room += 1

        rate_ids = sorted(rate_ids_by_date.get(current_date, set()))
        summaries.append(
            {
                "stay_date": current_date,
                "total_active_room": active_room,
                "total_active_rate": len(rate_ids),
                "booked_room": booked_room,
                "available_room": available_room,
                "unavailable_room": max(active_room - available_room, 0),
                "room_ids": room_ids,
                "rate_ids": rate_ids,
            }
        )
        current_date += timedelta(days=1)

    return summaries
