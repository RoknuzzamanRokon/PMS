from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Iterable
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import MetaData, Table, create_engine, select, text
from sqlalchemy.engine import Engine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy all data from the local SQLite database into the configured MySQL database.",
    )
    parser.add_argument(
        "--source",
        help="Source database URL. Defaults to APP_DATABASE_URL from backend/.env.",
    )
    parser.add_argument(
        "--target",
        help="Target database URL. Defaults to DATABASE_URL from backend/.env.",
    )
    parser.add_argument(
        "--wipe-target",
        action="store_true",
        help="Delete existing rows from target tables before copying.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Rows to insert per batch. Default: 500",
    )
    return parser.parse_args()


def chunked(rows: list[dict], batch_size: int) -> Iterable[list[dict]]:
    for index in range(0, len(rows), batch_size):
        yield rows[index:index + batch_size]


def normalize_row(row: dict) -> dict:
    normalized = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            normalized[key] = str(value)
        else:
            normalized[key] = value
    return normalized


def align_row_to_target(source_row: dict, target_table: Table) -> dict:
    source_by_lower = {key.lower(): value for key, value in source_row.items()}
    aligned = {}
    for column in target_table.columns:
        lookup_key = column.name.lower()
        if lookup_key in source_by_lower:
            aligned[column.name] = source_by_lower[lookup_key]
    return aligned


def reflect_metadata(engine: Engine) -> MetaData:
    metadata = MetaData()
    metadata.reflect(bind=engine)
    return metadata


def wipe_target_tables(target_engine: Engine, tables: list[Table]) -> None:
    with target_engine.begin() as connection:
        connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for table in reversed(tables):
            connection.execute(table.delete())
        connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))


def ensure_target_schema_compatibility(target_engine: Engine) -> None:
    ddl_statements = [
        'ALTER TABLE `z_availability_status` MODIFY COLUMN `code` VARCHAR(32) NOT NULL',
        'ALTER TABLE `rate_calendar` DROP FOREIGN KEY `fk_calendar_avail`',
        'ALTER TABLE `rate_calendar` MODIFY COLUMN `availability` VARCHAR(32) DEFAULT NULL',
        'ALTER TABLE `rate_calendar` ADD CONSTRAINT `fk_calendar_avail` FOREIGN KEY (`availability`) REFERENCES `z_availability_status` (`code`) ON DELETE SET NULL ON UPDATE CASCADE',
        "ALTER TABLE `rooms` ADD COLUMN `room_status` VARCHAR(32) NOT NULL DEFAULT 'PROCESSING'",
        "ALTER TABLE `rate_plans` ADD COLUMN `supplier_name` VARCHAR(128) NULL",
    ]
    ignorable_error_markers = (
        "Duplicate column name",
        "check that column/key exists",
        "already exists",
    )
    with target_engine.begin() as connection:
        for statement in ddl_statements:
            try:
                connection.execute(text(statement))
            except Exception as exc:  # noqa: BLE001
                message = str(exc)
                if not any(marker in message for marker in ignorable_error_markers):
                    raise


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    load_dotenv(project_root / ".env")
    args = parse_args()

    source_url = args.source or os.getenv("APP_DATABASE_URL")
    target_url = args.target or os.getenv("DATABASE_URL")

    if not source_url:
        raise SystemExit("Missing source database URL. Set APP_DATABASE_URL or pass --source.")
    if not target_url:
        raise SystemExit("Missing target database URL. Set DATABASE_URL or pass --target.")
    if source_url == target_url:
        raise SystemExit("Source and target database URLs are identical. Refusing to run.")

    source_engine = create_engine(source_url, future=True)
    target_engine = create_engine(target_url, future=True)

    from app import models  # noqa: F401, WPS433
    from app.database import Base  # noqa: WPS433

    ensure_target_schema_compatibility(target_engine)
    Base.metadata.create_all(target_engine)

    source_metadata = reflect_metadata(source_engine)
    target_metadata = reflect_metadata(target_engine)
    target_tables = [
        target_metadata.tables[table.name]
        for table in Base.metadata.sorted_tables
        if table.name in source_metadata.tables and table.name in target_metadata.tables
    ]

    if args.wipe_target:
        wipe_target_tables(target_engine, target_tables)

    migrated_counts: list[tuple[str, int]] = []

    with source_engine.connect() as source_connection, target_engine.begin() as target_connection:
        target_connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        try:
            for target_table in target_tables:
                source_table = source_metadata.tables[target_table.name]
                rows = [
                    align_row_to_target(
                        normalize_row(dict(row._mapping)),
                        target_table,
                    )
                    for row in source_connection.execute(select(source_table)).fetchall()
                ]
                if not rows:
                    migrated_counts.append((target_table.name, 0))
                    continue

                for batch in chunked(rows, args.batch_size):
                    target_connection.execute(target_table.insert(), batch)
                migrated_counts.append((target_table.name, len(rows)))
        finally:
            target_connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))

    total_rows = sum(count for _, count in migrated_counts)
    print("Migration complete.")
    for table_name, count in migrated_counts:
        print(f"{table_name}: {count}")
    print(f"Total rows copied: {total_rows}")


if __name__ == "__main__":
    main()
