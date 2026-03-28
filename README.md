# Inno Rooms

Inno Rooms is a hotel property management system prototype with a FastAPI backend and a Next.js frontend. The project includes property, room, inventory, booking, rate-plan, and dashboard flows, along with seed data for local development.

## Project Overview

- `backend/`: FastAPI application, SQLAlchemy models, API routes, seed data, and local SQLite database support
- `frontend/`: Next.js 15 frontend for the PMS dashboard and operational pages
- `ui/`: standalone HTML mockups that appear to be the original UI references
- `diagrm/`: database and schema notes
- `database/`: reserved folder for database-related assets

## Main Features

- Dashboard view for hotel operations
- Property management pages
- Room management and room overview endpoints
- Daily rates and rate-plan handling
- Inventory management
- Booking and reservation-related flows
- Guest, search, and availability endpoints
- Demo seed data for quick local testing

## Tech Stack

### Backend

- Python 3.12
- FastAPI
- SQLAlchemy
- Uvicorn
- `python-dotenv`
- SQLite by default, with MySQL support available through SQLAlchemy/PyMySQL

### Frontend

- Next.js 15
- React 19
- Tailwind CSS

## Repository Structure

```text
Inno_rooms/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── seed.py
│   │   └── routes/
│   ├── API_DOCUMENTATION.md
│   ├── Pipfile
│   └── innorooms.db
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── ui/
├── diagrm/
└── README.md
```

## Local Setup

### 1. Clone the project

```bash
git clone <your-repository-url>
cd Inno_rooms
```

### 2. Start the backend

From the `backend` directory:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install pipenv
pipenv install
.venv/bin/uvicorn app.main:app --reload
```

The API will run at:

```text
http://127.0.0.1:8000
```

Useful backend URLs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 3. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at:

```text
http://localhost:3000
```

## Environment Notes

### Backend

The backend loads environment variables from `backend/.env`.

Useful variables used by the app:

- `APP_DATABASE_URL`: database connection string
- `APP_CORS_ORIGINS`: comma-separated allowed frontend origins

If you want a simple local setup, use SQLite, for example:

```env
APP_DATABASE_URL=sqlite:///./innorooms.db
APP_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Frontend

The frontend API client uses:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

If this variable is not set, that same URL is already used as the default fallback.

## Seed Data

On backend startup, the app creates tables and seeds demo data automatically from `backend/app/seed.py`.

Included seed data covers:

- demo user login
- property types
- meal plans
- availability statuses
- rooms
- rate plans
- rate calendar entries
- guests
- reservations and related records

Demo login:

- Username: `admin`
- Password: `admin123`

## API Summary

The backend mounts routes under:

```text
/api/v1
```

Main route groups currently registered:

- `/auth`
- `/available-rooms`
- `/properties`
- `/meal-plans`
- `/rooms`
- `/rate-plans`
- `/guests`
- `/reservations`
- `/search`
- `/dashboard`
- `/inventory`

For endpoint details, see [backend/API_DOCUMENTATION.md](/mnt/Project/Python/Inno_rooms/backend/API_DOCUMENTATION.md).

## Frontend Pages

The Next.js frontend currently includes pages for:

- `/` dashboard
- `/properties`
- `/rooms-management`
- `/daily-rates`
- `/inventory`
- `/booking`

## Notes

- The backend startup process also applies a couple of lightweight schema safety updates for missing columns in existing databases.
- The project contains both working app code and design/reference assets.
- The frontend was recreated from the static HTML files in `ui/`.

## Suggested Next Improvements

- Add root-level `.env.example` files for backend and frontend
- Add backend tests and frontend lint/test setup
- Add Docker support for one-command local startup
- Document database schema and deployment steps

