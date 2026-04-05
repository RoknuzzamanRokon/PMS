from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, SessionLocal, engine
from .routes.api import api_router
from .seed import seed_database

load_dotenv()

app = FastAPI(title="Inno Rooms API", version="1.0.0")

origins = os.getenv("APP_CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


def ensure_rate_plan_supplier_column() -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("rate_plans")}
    if "supplier_name" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE rate_plans ADD COLUMN supplier_name VARCHAR(128)"))


def ensure_room_status_column() -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("rooms")}
    if "room_status" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE rooms ADD COLUMN room_status VARCHAR(32) DEFAULT 'PROCESSING'"))
        connection.execute(text("UPDATE rooms SET room_status = 'PROCESSING' WHERE room_status IS NULL"))


def ensure_room_inventory_rate_id_column() -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("room_inventory_calendar")}
    if "rate_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE room_inventory_calendar ADD COLUMN rate_id VARCHAR(32)"))

    with SessionLocal() as db:
        inventory_rows = db.execute(
            text(
                """
                SELECT id, room_id
                FROM room_inventory_calendar
                WHERE rate_id IS NULL OR rate_id = ''
                """
            )
        ).all()
        if not inventory_rows:
            return

        rate_plan_by_room = {
            row[0]: row[1]
            for row in db.execute(
                text(
                    """
                    SELECT room_id, rate_id
                    FROM rate_plans
                    WHERE status = 1
                    ORDER BY room_id ASC, created_at ASC
                    """
                )
            ).all()
        }
        if not rate_plan_by_room:
            rate_plan_by_room = {
                row[0]: row[1]
                for row in db.execute(
                    text(
                        """
                        SELECT room_id, rate_id
                        FROM rate_plans
                        ORDER BY room_id ASC, created_at ASC
                        """
                    )
                ).all()
            }

        for inventory_id, room_id in inventory_rows:
            rate_id = rate_plan_by_room.get(room_id)
            if not rate_id:
                continue
            db.execute(
                text("UPDATE room_inventory_calendar SET rate_id = :rate_id WHERE id = :inventory_id"),
                {"rate_id": rate_id, "inventory_id": inventory_id},
            )
        db.commit()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_rate_plan_supplier_column()
    ensure_room_status_column()
    ensure_room_inventory_rate_id_column()
    with SessionLocal() as db:
        seed_database(db)


@app.get("/")
def healthcheck():
    return {"status": "ok", "service": "Inno Rooms API"}
