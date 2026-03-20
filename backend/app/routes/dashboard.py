from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Guest, Payment, Property, RatePlan, Reservation, ReservationRoom, Room
from ..schemas import DashboardSummaryResponse
from ..utils import decimal_sum

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(db: Session = Depends(get_db)):
    properties = db.scalar(select(func.count()).select_from(Property)) or 0
    rooms = db.scalar(select(func.count()).select_from(Room)) or 0
    guests = db.scalar(select(func.count()).select_from(Guest)) or 0
    active_rate_plans = db.scalar(select(func.count()).select_from(RatePlan).where(RatePlan.status == 1)) or 0
    reservations = db.scalar(select(func.count()).select_from(Reservation)) or 0
    payments_total = decimal_sum(db.scalar(select(func.sum(Payment.amount)).select_from(Payment)))
    sold_inventory = decimal_sum(db.scalar(select(func.sum(RatePlan.sold_inventory)).select_from(RatePlan)))
    total_inventory = decimal_sum(db.scalar(select(func.sum(RatePlan.total_inventory)).select_from(RatePlan)))
    occupancy_percent = float((sold_inventory / total_inventory) * 100) if total_inventory else 0.0
    today = date.today()
    arrivals_today = db.scalar(
        select(func.count()).select_from(Reservation).where(Reservation.check_in_date == today)
    ) or 0
    departures_today = db.scalar(
        select(func.count()).select_from(Reservation).where(Reservation.check_out_date == today)
    ) or 0

    return DashboardSummaryResponse(
        properties=properties,
        rooms=rooms,
        guests=guests,
        active_rate_plans=active_rate_plans,
        reservations=reservations,
        payments_total=payments_total,
        occupancy_percent=round(occupancy_percent, 2),
        arrivals_today=arrivals_today,
        departures_today=departures_today,
    )


@router.get("/overview")
def dashboard_overview(db: Session = Depends(get_db)):
    summary = dashboard_summary(db)
    today = date.today()

    arrivals = (
        db.execute(
            select(Reservation, Guest, ReservationRoom)
            .join(Guest, Guest.guest_id == Reservation.guest_id)
            .join(ReservationRoom, ReservationRoom.booking_id == Reservation.booking_id)
            .where(Reservation.check_in_date == today)
            .order_by(Reservation.created_at.desc())
        )
        .all()
    )

    departures = (
        db.execute(
            select(Reservation, Guest, ReservationRoom)
            .join(Guest, Guest.guest_id == Reservation.guest_id)
            .join(ReservationRoom, ReservationRoom.booking_id == Reservation.booking_id)
            .where(Reservation.check_out_date == today)
            .order_by(Reservation.created_at.desc())
        )
        .all()
    )

    payments = (
        db.execute(select(Payment).order_by(Payment.created_at.desc()).limit(5))
        .scalars()
        .all()
    )

    active_rate_plans = (
        db.execute(select(RatePlan).order_by(RatePlan.sold_inventory.desc()).limit(4))
        .scalars()
        .all()
    )

    return {
        "summary": summary.model_dump(),
        "arrivals": [
            {
                "booking_id": reservation.booking_id,
                "guest_name": f"{guest.first_name} {guest.last_name}",
                "room_name": reservation_room.room_name,
                "check_in_date": reservation.check_in_date.isoformat(),
                "check_out_date": reservation.check_out_date.isoformat(),
                "booking_status": reservation.booking_status,
            }
            for reservation, guest, reservation_room in arrivals
        ],
        "departures": [
            {
                "booking_id": reservation.booking_id,
                "guest_name": f"{guest.first_name} {guest.last_name}",
                "room_name": reservation_room.room_name,
                "check_in_date": reservation.check_in_date.isoformat(),
                "check_out_date": reservation.check_out_date.isoformat(),
                "booking_status": reservation.booking_status,
            }
            for reservation, guest, reservation_room in departures
        ],
        "payments": [
            {
                "payment_id": payment.payment_id,
                "booking_id": payment.booking_id,
                "amount": float(payment.amount),
                "currency": payment.currency,
                "payment_status": payment.payment_status,
                "payment_method": payment.payment_method,
            }
            for payment in payments
        ],
        "top_rate_plans": [
            {
                "rate_id": item.rate_id,
                "title": item.title,
                "sold_inventory": item.sold_inventory,
                "available_inventory": item.available_inventory,
            }
            for item in active_rate_plans
        ],
    }
