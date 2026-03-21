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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_rate_plan_supplier_column()
    ensure_room_status_column()
    with SessionLocal() as db:
        seed_database(db)


@app.get("/")
def healthcheck():
    return {"status": "ok", "service": "Inno Rooms API"}
