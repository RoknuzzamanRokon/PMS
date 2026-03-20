from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class PropertyBase(BaseModel):
    name: str
    name_lang: Optional[str] = None
    property_type: str


class PropertyCreate(PropertyBase):
    property_id: Optional[str] = None


class PropertyRead(APIModel):
    property_id: str
    name: str
    name_lang: Optional[str] = None
    property_type: str
    created_at: datetime
    updated_at: datetime


class RoomBase(BaseModel):
    property_id: str
    room_name: str
    room_name_lang: Optional[str] = None
    base_rate: Decimal = Decimal("0")
    tax_and_service_fee: Decimal = Decimal("0")
    surcharges: Decimal = Decimal("0")
    mandatory_fee: Decimal = Decimal("0")
    resort_fee: Decimal = Decimal("0")
    mandatory_tax: Decimal = Decimal("0")


class RoomCreate(RoomBase):
    room_id: Optional[str] = None


class RoomRead(APIModel):
    room_id: str
    property_id: str
    room_name: str
    room_name_lang: Optional[str] = None
    base_rate: Decimal
    tax_and_service_fee: Decimal
    surcharges: Decimal
    mandatory_fee: Decimal
    resort_fee: Decimal
    mandatory_tax: Decimal
    created_at: datetime
    updated_at: datetime


class RatePlanBase(BaseModel):
    room_id: str
    title: str
    description: Optional[str] = None
    meal_plan: str = "RO"
    is_refundable: bool = True
    bed_type: str = "King"
    cancellation_policy: str = "24h flexible"
    status: bool = True
    min_stay: int = 1
    max_stay: int = 30
    currency: str = "USD"
    base_rate: Decimal = Decimal("0")
    tax_and_service_fee: Decimal = Decimal("0")
    surcharges: Decimal = Decimal("0")
    mandatory_fee: Decimal = Decimal("0")
    resort_fee: Decimal = Decimal("0")
    mandatory_tax: Decimal = Decimal("0")
    total_inventory: int = 0
    available_inventory: int = 0
    sold_inventory: int = 0
    closed_to_arrival: bool = False
    closed_to_departure: bool = False
    stop_sell: bool = False
    extra_adult_rate: Decimal = Decimal("0")
    extra_child_rate: Decimal = Decimal("0")


class RatePlanCreate(RatePlanBase):
    rate_id: Optional[str] = None


class RatePlanRead(APIModel):
    rate_id: str
    room_id: str
    title: str
    description: Optional[str] = None
    meal_plan: str
    is_refundable: int
    bed_type: str
    cancellation_policy: str
    status: int
    min_stay: int
    max_stay: int
    currency: str
    base_rate: Decimal
    tax_and_service_fee: Decimal
    surcharges: Decimal
    mandatory_fee: Decimal
    resort_fee: Decimal
    mandatory_tax: Decimal
    total_inventory: int
    available_inventory: int
    sold_inventory: int
    closed_to_arrival: int
    closed_to_departure: int
    stop_sell: int
    extra_adult_rate: Decimal
    extra_child_rate: Decimal
    created_at: datetime
    updated_at: datetime


class CalendarItemBase(BaseModel):
    stay_date: date
    currency: str = "USD"
    base_rate: Decimal
    tax: Decimal = Decimal("0")
    availability: str = "AVAILABLE"


class CalendarItemCreate(CalendarItemBase):
    pass


class CalendarBulkUpsertRequest(BaseModel):
    items: list[CalendarItemCreate]


class CalendarItemRead(APIModel):
    rate_id: str
    stay_date: date
    currency: str
    base_rate: Decimal
    tax: Decimal
    availability: str
    created_at: datetime
    updated_at: datetime


class GuestCreate(BaseModel):
    guest_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: str
    loyalty_status: str = "STANDARD"


class GuestRead(APIModel):
    guest_id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    loyalty_status: str
    created_at: datetime
    updated_at: datetime


class ReservationRoomPayload(BaseModel):
    room_id: str
    rate_id: str
    occupant_name: str


class ReservationCreate(BaseModel):
    booking_id: Optional[str] = None
    property_id: str
    guest_id: str
    check_in_date: date
    check_out_date: date
    currency: str = "USD"
    booking_status: str = "CONFIRMED"
    rooms: list[ReservationRoomPayload] = Field(default_factory=list)


class ReservationRead(APIModel):
    booking_id: str
    property_id: str
    guest_id: str
    check_in_date: date
    check_out_date: date
    total_price: Decimal
    currency: str
    booking_status: str
    created_at: datetime
    updated_at: datetime


class ReservationStatusUpdate(BaseModel):
    booking_status: str


class PaymentCreate(BaseModel):
    payment_id: Optional[str] = None
    amount: Decimal
    currency: str = "USD"
    payment_method: str = "CARD"
    payment_status: str = "CAPTURED"
    transaction_ref: str


class PaymentRead(APIModel):
    payment_id: str
    booking_id: str
    amount: Decimal
    currency: str
    payment_method: str
    payment_status: str
    transaction_ref: str
    created_at: datetime
    updated_at: datetime


class AvailabilitySearchResponse(BaseModel):
    property_id: str
    check_in_date: date
    check_out_date: date
    available_rate_plans: list[dict]


class DashboardSummaryResponse(BaseModel):
    properties: int
    rooms: int
    guests: int
    active_rate_plans: int
    reservations: int
    payments_total: Decimal
    occupancy_percent: float
    arrivals_today: int
    departures_today: int
