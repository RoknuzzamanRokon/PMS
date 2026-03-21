from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AvailabilityStatus, Guest, Payment, Property, RateCalendar, RatePlan, Reservation, ReservationRoom, Room, User


def _exists(db: Session, model, field_name: str, value: str) -> bool:
    return (
        db.scalar(select(model.id).where(getattr(model, field_name) == value).limit(1))
        is not None
    )


def seed_database(db: Session) -> None:
    today = date.today()

    availability_status_records = [
        (1, "1", "AVAILABLE", "Room is free and can be booked."),
        (2, "2", "BOOKED", "Room is already reserved by a guest."),
        (3, "3", "STOP_SELL", "Hotel stops selling the room even if inventory exists."),
        (4, "4", "CTA", "Guests cannot check-in on that date, but they may stay if they checked in earlier."),
        (5, "5", "CTD", "Guests cannot check out on that date."),
        (6, "6", "OUT_OF_ORDER", "Room cannot be sold because of maintenance or damage."),
        (7, "7", "OUT_OF_SERVICE", "Room is temporarily unavailable but not under major repair."),
        (11, "8", "OVERBOOKED", "Hotel sells more rooms than available intentionally."),
    ]
    for status_id, code, title, description in availability_status_records:
        status = db.scalar(select(AvailabilityStatus).where(AvailabilityStatus.code == code))
        if status:
            status.title = title
            status.description = description
        else:
            db.add(
                AvailabilityStatus(
                    id=status_id,
                    code=code,
                    title=title,
                    description=description,
                )
            )

    if not _exists(db, User, "username", "admin"):
        db.add(
            User(
                user_id="USR001",
                username="admin",
                password_hash="admin123",
                first_name="Alex",
                last_name="Rivers",
                role="manager",
                status=1,
            )
        )

    if not _exists(db, Property, "property_id", "PROP001"):
        db.add(
            Property(
                property_id="PROP00",
                name="Grand Plaza Hotel",
                name_lang="Grand Plaza Hotel",
                property_type="HOTEL",
            )
        )

    room_records = [
        ("ROOM001", "Deluxe Suite", Decimal("240.00"), Decimal("18.00")),
        ("ROOM002", "Standard Double", Decimal("145.00"), Decimal("10.00")),
        ("ROOM003", "Executive Twin", Decimal("180.00"), Decimal("12.00")),
        ("ROOM004", "Family Suite", Decimal("215.00"), Decimal("15.00")),
        ("ROOM005", "Single Economy", Decimal("95.00"), Decimal("6.00")),
    ]
    for room_id, room_name, base_rate, tax_fee in room_records:
        if not _exists(db, Room, "room_id", room_id):
            db.add(
                Room(
                    property_id="PROP001",
                    room_id=room_id,
                    room_name=room_name,
                    room_name_lang=room_name,
                    room_status="PROCESSING",
                    base_rate=base_rate,
                    tax_and_service_fee=tax_fee,
                    surcharges=Decimal("5.00"),
                    mandatory_fee=Decimal("3.00"),
                    resort_fee=Decimal("2.00"),
                    mandatory_tax=Decimal("7.00"),
                )
            )

    rate_plan_records = [
        ("RATE001", "ROOM001", "Deluxe Flexible", "Best flexible rate for deluxe suite", 12, 4, 8),
        ("RATE002", "ROOM002", "Standard Saver", "Non-refundable rate for standard double", 45, 18, 27),
        ("RATE003", "ROOM003", "Executive Corporate", "Corporate package for executive twin", 18, 7, 11),
        ("RATE004", "ROOM004", "Family Escape", "Family package with breakfast", 14, 5, 9),
        ("RATE005", "ROOM005", "Single Smart", "Entry rate for short city stays", 8, 5, 3),
    ]
    for index, (rate_id, room_id, title, description, total_inventory, available_inventory, sold_inventory) in enumerate(
        rate_plan_records,
        start=1,
    ):
        if not _exists(db, RatePlan, "rate_id", rate_id):
            room = db.scalar(select(Room).where(Room.room_id == room_id))
            base_rate = room.base_rate if room else Decimal("100.00")
            tax_fee = room.tax_and_service_fee if room else Decimal("8.00")
            db.add(
                RatePlan(
                    rate_id=rate_id,
                    room_id=room_id,
                    title=title,
                    description=description,
                    meal_plan="BB" if index % 2 else "RO",
                    is_refundable=0 if rate_id == "RATE002" else 1,
                    bed_type="King" if index % 2 else "Twin",
                    cancellation_policy="24h flexible",
                    status=1,
                    min_stay=1,
                    max_stay=30,
                    currency="USD",
                    base_rate=base_rate,
                    tax_and_service_fee=tax_fee,
                    surcharges=Decimal("5.00"),
                    mandatory_fee=Decimal("3.00"),
                    resort_fee=Decimal("2.00"),
                    mandatory_tax=Decimal("7.00"),
                    total_inventory=total_inventory,
                    available_inventory=available_inventory,
                    sold_inventory=sold_inventory,
                    closed_to_arrival=1 if rate_id == "RATE004" else 0,
                    closed_to_departure=1 if rate_id == "RATE005" else 0,
                    stop_sell=1 if rate_id == "RATE001" and index % 2 == 0 else 0,
                    extra_adult_rate=Decimal("25.00"),
                    extra_child_rate=Decimal("15.00"),
                )
            )

    db.flush()

    for rate_id, _, _, _, _, _, _ in rate_plan_records:
        existing_calendar = db.scalar(select(RateCalendar.id).where(RateCalendar.rate_id == rate_id).limit(1))
        if existing_calendar:
            continue
        rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == rate_id))
        for offset in range(30):
            stay_date = today + timedelta(days=offset)
            seasonal_lift = Decimal(str((offset % 7) * 5))
            availability = "BOOKED" if offset in (5, 6, 12, 13) else "AVAILABLE"
            if rate_id == "RATE005" and offset in (0, 1):
                availability = "STOP_SELL"
            if rate_id == "RATE004" and offset == 9:
                availability = "CTA"
            if rate_id == "RATE003" and offset == 11:
                availability = "CTD"
            db.add(
                RateCalendar(
                    rate_id=rate_id,
                    stay_date=stay_date,
                    currency=rate_plan.currency,
                    base_rate=rate_plan.base_rate + seasonal_lift,
                    tax=rate_plan.tax_and_service_fee,
                    availability=availability,
                )
            )

    guest_records = [
        ("GST001", "James", "Smith", "james@example.com", "+12025550101", "GOLD"),
        ("GST002", "Sofia", "Chen", "sofia@example.com", "+12025550102", "SILVER"),
        ("GST003", "Maria", "Garcia", "maria@example.com", "+12025550103", "GOLD"),
        ("GST004", "Daniel", "Reed", "daniel@example.com", "+12025550104", "STANDARD"),
    ]
    for guest_id, first_name, last_name, email, phone, loyalty_status in guest_records:
        if not _exists(db, Guest, "guest_id", guest_id):
            db.add(
                Guest(
                    guest_id=guest_id,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    loyalty_status=loyalty_status,
                )
            )

    reservation_records = [
        ("BOOK001", "GST001", "ROOM001", "RATE001", today, today + timedelta(days=2), "CONFIRMED", "James Smith"),
        ("BOOK002", "GST002", "ROOM003", "RATE003", today + timedelta(days=1), today + timedelta(days=4), "CHECKED_IN", "Sofia Chen"),
        ("BOOK003", "GST003", "ROOM004", "RATE004", today + timedelta(days=4), today + timedelta(days=6), "PENDING", "Maria Garcia"),
        ("BOOK004", "GST004", "ROOM002", "RATE002", today + timedelta(days=6), today + timedelta(days=8), "CONFIRMED", "Daniel Reed"),
    ]
    for booking_id, guest_id, room_id, rate_id, check_in, check_out, status, occupant_name in reservation_records:
        if _exists(db, Reservation, "booking_id", booking_id):
            continue
        rate_plan = db.scalar(select(RatePlan).where(RatePlan.rate_id == rate_id))
        total_price = Decimal(rate_plan.base_rate) + Decimal(rate_plan.tax_and_service_fee)
        room = db.scalar(select(Room).where(Room.room_id == room_id))
        db.add(
            Reservation(
                booking_id=booking_id,
                property_id="PROP001",
                guest_id=guest_id,
                check_in_date=check_in,
                check_out_date=check_out,
                total_price=total_price,
                currency="USD",
                booking_status=status,
            )
        )
        db.add(
            ReservationRoom(
                booking_id=booking_id,
                room_id=room_id,
                rate_id=rate_id,
                room_name=room.room_name if room else room_id,
                room_name_lang=room.room_name if room else room_id,
                room_rate_snapshot=rate_plan.base_rate,
                tax_snapshot=rate_plan.tax_and_service_fee,
                occupant_name=occupant_name,
            )
        )

    payment_records = [
        ("PAY001", "BOOK001", Decimal("320.00"), "CARD", "CAPTURED", "TXN-BOOK001-1"),
        ("PAY002", "BOOK002", Decimal("192.00"), "CARD", "CAPTURED", "TXN-BOOK002-1"),
        ("PAY003", "BOOK004", Decimal("155.00"), "BANK", "PENDING", "TXN-BOOK004-1"),
    ]
    for payment_id, booking_id, amount, method, status, transaction_ref in payment_records:
        if not _exists(db, Payment, "payment_id", payment_id):
            db.add(
                Payment(
                    payment_id=payment_id,
                    booking_id=booking_id,
                    amount=amount,
                    currency="USD",
                    payment_method=method,
                    payment_status=status,
                    transaction_ref=transaction_ref,
                )
            )

    db.commit()
