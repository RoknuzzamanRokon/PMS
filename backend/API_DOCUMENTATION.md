# Inno Rooms Backend API Documentation

This document describes the **current implementation** of the FastAPI backend in this project.

## Location

- App entrypoint: [app/main.py](/mnt/Project/Python/Inno_rooms/backend/app/main.py)
- Route registry: [app/routes/api.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/api.py)

## Run The API

From the `backend` folder:

```bash
.venv/bin/uvicorn app.main:app --reload
```

Default local URL:

```text
http://127.0.0.1:8000
```

Interactive docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Demo Credentials

Seeded demo login:

- Username: `admin`
- Password: `admin123`

## Notes

- The backend uses `APP_DATABASE_URL` from [backend/.env](/mnt/Project/Python/Inno_rooms/backend/.env)
- Current local default is SQLite: `sqlite:///./innorooms.db`
- Seed data is created/updated on startup from [app/seed.py](/mnt/Project/Python/Inno_rooms/backend/app/seed.py)

## Base API Prefix

```text
/api/v1
```

## Health Check

### `GET /`

Basic service health endpoint.

Response example:

```json
{
  "status": "ok",
  "service": "Inno Rooms API"
}
```

## Auth

### `POST /api/v1/auth/login`

Authenticates a demo user.

Request body:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response example:

```json
{
  "access_token": "demo-token-USR001",
  "token_type": "bearer",
  "user": {
    "user_id": "USR001",
    "username": "admin",
    "name": "Alex Rivers",
    "role": "manager"
  }
}
```

## Properties

### `GET /api/v1/properties`

Returns all properties.

### `POST /api/v1/properties`

Creates a property.

Request body:

```json
{
  "name": "City View Hotel",
  "name_lang": "City View Hotel",
  "property_type": "HOTEL"
}
```

Optional: `property_id`

### `GET /api/v1/properties/{property_id}`

Returns one property by `property_id`.

## Rooms

### `GET /api/v1/rooms`

Returns all rooms.

Optional query params:

- `property_id`

Example:

```text
GET /api/v1/rooms?property_id=PROP001
```

### `POST /api/v1/rooms`

Creates a room.

Request body:

```json
  {
    "property_id": "PROP001",
    "room_name": "Deluxe Suite",
    "room_name_lang": "Deluxe Suite",
    "base_rate": 240,
    "tax_and_service_fee": 18,
    "surcharges": 5,
    "mandatory_fee": 3,
    "resort_fee": 2,
    "mandatory_tax": 7
  }
```

Optional: `room_id`

### `GET /api/v1/rooms/overview`

Frontend-oriented room summary feed used by the rooms management UI.

Required query params:

- `property_id`

Example:

```text
GET /api/v1/rooms/overview?property_id=PROP001
```

Response sections:

- `property`
- `summary`
- `categories`
- `rooms`

### `GET /api/v1/rooms/{room_id}`

Returns one room by `room_id`.

## Rate Plans

### `GET /api/v1/rate-plans`

Returns all rate plans.

Optional query params:

- `room_id`

Example:

```text
GET /api/v1/rate-plans?room_id=ROOM001
```

### `POST /api/v1/rate-plans`

Creates a rate plan.

Request body example:

```json
{
  "room_id": "ROOM001",
  "title": "Deluxe Flexible",
  "description": "Best flexible rate",
  "meal_plan": "BB",
  "is_refundable": true,
  "bed_type": "King",
  "cancellation_policy": "24h flexible",
  "status": true,
  "min_stay": 1,
  "max_stay": 30,
  "currency": "USD",
  "base_rate": 240,
  "tax_and_service_fee": 18,
  "surcharges": 5,
  "mandatory_fee": 3,
  "resort_fee": 2,
  "mandatory_tax": 7,
  "total_inventory": 12,
  "available_inventory": 4,
  "sold_inventory": 8,
  "closed_to_arrival": false,
  "closed_to_departure": false,
  "stop_sell": false,
  "extra_adult_rate": 25,
  "extra_child_rate": 15
}
```

Optional: `rate_id`

### `GET /api/v1/rate-plans/{rate_id}`

Returns one rate plan by `rate_id`.

### `POST /api/v1/rate-plans/{rate_id}/calendar/bulk-upsert`

Creates or updates many calendar rows for a rate plan.

Request body:

```json
{
  "items": [
    {
      "stay_date": "2026-03-20",
      "currency": "USD",
      "base_rate": 255,
      "tax": 18,
      "availability": "AVAILABLE"
    }
  ]
}
```

Response example:

```json
{
  "rate_id": "RATE001",
  "created": 1,
  "updated": 0
}
```

### `GET /api/v1/rate-plans/{rate_id}/calendar`

Returns calendar rows for a rate plan.

Optional query params:

- `start_date`
- `end_date`

Example:

```text
GET /api/v1/rate-plans/RATE001/calendar?start_date=2026-03-20&end_date=2026-03-27
```

## Guests

### `POST /api/v1/guests`

Creates a guest.

Request body:

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+12025550000",
  "loyalty_status": "STANDARD"
}
```

Optional: `guest_id`

### `GET /api/v1/guests/{guest_id}`

Returns one guest by `guest_id`.

## Reservations

### `POST /api/v1/reservations`

Creates a reservation and linked reservation-room rows.

Request body:

```json
{
  "property_id": "PROP001",
  "guest_id": "GST001",
  "check_in_date": "2026-03-20",
  "check_out_date": "2026-03-22",
  "currency": "USD",
  "booking_status": "CONFIRMED",
  "rooms": [
    {
      "room_id": "ROOM001",
      "rate_id": "RATE001",
      "occupant_name": "James Smith"
    }
  ]
}
```

Optional: `booking_id`

### `GET /api/v1/reservations/{booking_id}`

Returns one reservation by `booking_id`.

### `PATCH /api/v1/reservations/{booking_id}/status`

Updates reservation status.

Request body:

```json
{
  "booking_status": "CHECKED_IN"
}
```

### `POST /api/v1/reservations/{booking_id}/payments`

Creates a payment for a reservation.

Request body:

```json
{
  "amount": 250,
  "currency": "USD",
  "payment_method": "CARD",
  "payment_status": "CAPTURED",
  "transaction_ref": "TXN-12345"
}
```

Optional: `payment_id`

### `GET /api/v1/reservations/{booking_id}/payments`

Returns all payments for a reservation.

## Search

### `GET /api/v1/search/availability`

Searches available rate plans for a property date range.

Required query params:

- `property_id`
- `check_in_date`
- `check_out_date`

Example:

```text
GET /api/v1/search/availability?property_id=PROP001&check_in_date=2026-03-20&check_out_date=2026-03-22
```

Response includes:

- `property_id`
- `check_in_date`
- `check_out_date`
- `available_rate_plans`

## Dashboard

### `GET /api/v1/dashboard/summary`

Compact dashboard summary.

Response includes:

- `properties`
- `rooms`
- `guests`
- `active_rate_plans`
- `reservations`
- `payments_total`
- `occupancy_percent`
- `arrivals_today`
- `departures_today`

### `GET /api/v1/dashboard/overview`

Expanded dashboard feed used by the frontend dashboard page.

Response sections:

- `summary`
- `arrivals`
- `departures`
- `payments`
- `top_rate_plans`

## Inventory

### `GET /api/v1/inventory/calendar`

Frontend-oriented inventory calendar feed used by the inventory page.

Required query params:

- `property_id`

Optional query params:

- `start_date`
- `days` between `1` and `30`

Example:

```text
GET /api/v1/inventory/calendar?property_id=PROP001&days=14
```

Response sections:

- `property`
- `start_date`
- `days`
- `rows`

Each row contains:

- `room_id`
- `room_name`
- `booking`

If a booking exists, it contains:

- `left_days`
- `duration_days`
- `tone`
- `guest_name`
- `meta`
- `booking_id`

## Current Route Files

- [auth.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/auth.py)
- [properties.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/properties.py)
- [rooms.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/rooms.py)
- [rate_plans.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/rate_plans.py)
- [guests.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/guests.py)
- [reservations.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/reservations.py)
- [search.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/search.py)
- [dashboard.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/dashboard.py)
- [inventory.py](/mnt/Project/Python/Inno_rooms/backend/app/routes/inventory.py)
