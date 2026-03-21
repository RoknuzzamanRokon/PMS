from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    first_name: Mapped[str] = mapped_column(String(64))
    last_name: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32))
    status: Mapped[int] = mapped_column(Integer, default=1)


class Property(TimestampMixin, Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    property_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    name_lang: Mapped[str | None] = mapped_column(String(128), nullable=True)
    property_type: Mapped[str] = mapped_column(String(64))


class PropertyAmenity(Base):
    __tablename__ = "property_amenities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    property_id: Mapped[str] = mapped_column(String(100), ForeignKey("properties.property_id"), index=True)
    amenity_code: Mapped[str] = mapped_column(String(255), ForeignKey("z_amenities_codes.code"), index=True)


class Room(TimestampMixin, Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    property_id: Mapped[str] = mapped_column(String(32), ForeignKey("properties.property_id"), index=True)
    room_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    room_name: Mapped[str] = mapped_column(String(128))
    room_name_lang: Mapped[str | None] = mapped_column(String(128), nullable=True)
    room_status: Mapped[str] = mapped_column(String(32), default="PROCESSING")
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax_and_service_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    surcharges: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    mandatory_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    resort_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    mandatory_tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)


class RoomAmenity(Base):
    __tablename__ = "room_amenities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[str] = mapped_column(String(100), ForeignKey("rooms.room_id"), index=True)
    amenity_code: Mapped[str] = mapped_column(String(255), ForeignKey("z_amenities_codes.code"), index=True)


class RatePlan(TimestampMixin, Base):
    __tablename__ = "rate_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    room_id: Mapped[str] = mapped_column(String(32), ForeignKey("rooms.room_id"), index=True)
    title: Mapped[str] = mapped_column(String(128))
    supplier_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    meal_plan: Mapped[str] = mapped_column(String(32), default="RO")
    is_refundable: Mapped[int] = mapped_column(Integer, default=1)
    bed_type: Mapped[str] = mapped_column(String(64), default="King")
    cancellation_policy: Mapped[str] = mapped_column(String(128), default="24h flexible")
    status: Mapped[int] = mapped_column(Integer, default=1)
    min_stay: Mapped[int] = mapped_column(Integer, default=1)
    max_stay: Mapped[int] = mapped_column(Integer, default=30)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax_and_service_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    surcharges: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    mandatory_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    resort_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    mandatory_tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_inventory: Mapped[int] = mapped_column(Integer, default=0)
    available_inventory: Mapped[int] = mapped_column(Integer, default=0)
    sold_inventory: Mapped[int] = mapped_column(Integer, default=0)
    closed_to_arrival: Mapped[int] = mapped_column(Integer, default=0)
    closed_to_departure: Mapped[int] = mapped_column(Integer, default=0)
    stop_sell: Mapped[int] = mapped_column(Integer, default=0)
    extra_adult_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    extra_child_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)


class RateCalendar(TimestampMixin, Base):
    __tablename__ = "rate_calendar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate_id: Mapped[str] = mapped_column(String(32), ForeignKey("rate_plans.rate_id"), index=True)
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    availability: Mapped[str] = mapped_column(String(32), default="AVAILABLE")


class RateCancellationPolicy(TimestampMixin, Base):
    __tablename__ = "rate_cancellation_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate_id: Mapped[str] = mapped_column(String(255), ForeignKey("rate_plans.rate_id"), index=True)
    season_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    season_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    days_before_arrival: Mapped[int] = mapped_column(Integer)
    penalty_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    penalty_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Guest(TimestampMixin, Base):
    __tablename__ = "guests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    guest_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(64))
    last_name: Mapped[str] = mapped_column(String(64))
    email: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str] = mapped_column(String(32))
    loyalty_status: Mapped[str] = mapped_column(String(32), default="STANDARD")


class Reservation(TimestampMixin, Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    property_id: Mapped[str] = mapped_column(String(32), ForeignKey("properties.property_id"), index=True)
    guest_id: Mapped[str] = mapped_column(String(32), ForeignKey("guests.guest_id"), index=True)
    check_in_date: Mapped[date] = mapped_column(Date)
    check_out_date: Mapped[date] = mapped_column(Date)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    booking_status: Mapped[str] = mapped_column(String(32), default="CONFIRMED")


class ReservationRoom(TimestampMixin, Base):
    __tablename__ = "reservations_rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[str] = mapped_column(String(32), ForeignKey("reservations.booking_id"), index=True)
    room_id: Mapped[str] = mapped_column(String(32), ForeignKey("rooms.room_id"), index=True)
    rate_id: Mapped[str] = mapped_column(String(32), ForeignKey("rate_plans.rate_id"), index=True)
    room_name: Mapped[str] = mapped_column(String(128))
    room_name_lang: Mapped[str | None] = mapped_column(String(128), nullable=True)
    room_rate_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    occupant_name: Mapped[str] = mapped_column(String(128))


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    booking_id: Mapped[str] = mapped_column(String(32), ForeignKey("reservations.booking_id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    payment_method: Mapped[str] = mapped_column(String(32), default="CARD")
    payment_status: Mapped[str] = mapped_column(String(32), default="CAPTURED")
    transaction_ref: Mapped[str] = mapped_column(String(64))


class AmenityCode(Base):
    __tablename__ = "z_amenities_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    for_room: Mapped[int | None] = mapped_column(Integer, nullable=True)
    for_property: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AvailabilityStatus(Base):
    __tablename__ = "z_availability_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column("desc", String(255), nullable=True)


class MealPlan(Base):
    __tablename__ = "z_meal_plan"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column("desc", String(255), nullable=True)


class PropertyType(Base):
    __tablename__ = "z_property_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column("desc", String(255), nullable=True)
