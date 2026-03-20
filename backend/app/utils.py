from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session


def next_code(db: Session, model, field_name: str, prefix: str) -> str:
    current = db.execute(select(getattr(model, field_name))).scalars().all()
    max_number = 0
    for value in current:
        if value and value.startswith(prefix):
            suffix = value.removeprefix(prefix)
            if suffix.isdigit():
                max_number = max(max_number, int(suffix))
    return f"{prefix}{max_number + 1:03d}"


def decimal_sum(value) -> Decimal:
    return value or Decimal("0")
