"""
DuckDB engine — registers all Parquet tables as views.
In production, tables point to S3 via httpfs extension.
In local dev, they point to local Parquet files.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import duckdb
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

TABLES = [
    "customers",
    "policies",
    "claims",
    "providers",
    "agents",
    "adjusters",
    "fraud_labels",
    "weather_events",
    "kpi_snapshots",
]


def _register_tables(conn: duckdb.DuckDBPyConnection) -> None:
    """Register Parquet files as DuckDB views."""
    data_dir = Path(settings.DATA_DIR)

    if settings.USE_S3 and settings.S3_BUCKET:
        # AWS production: httpfs reads directly from S3
        conn.execute("INSTALL httpfs; LOAD httpfs;")
        conn.execute(f"SET s3_region='{settings.AWS_REGION}';")
        for table in TABLES:
            s3_path = f"s3://{settings.S3_BUCKET}/{settings.S3_PREFIX}{table}.parquet"
            conn.execute(f"CREATE OR REPLACE VIEW {table} AS SELECT * FROM read_parquet('{s3_path}')")
            log.info("registered_s3_view", table=table, path=s3_path)
    else:
        # Local dev: read from data/parquet/
        parquet_dir = data_dir / "parquet"
        for table in TABLES:
            parquet_path = parquet_dir / f"{table}.parquet"
            if parquet_path.exists():
                conn.execute(
                    f"CREATE OR REPLACE VIEW {table} AS "
                    f"SELECT * FROM read_parquet('{parquet_path.resolve()}')"
                )
                log.info("registered_local_view", table=table, path=str(parquet_path))
            else:
                log.warning("parquet_not_found", table=table, path=str(parquet_path))


@lru_cache(maxsize=1)
def get_db_engine() -> duckdb.DuckDBPyConnection:
    """
    Returns a singleton DuckDB connection with all tables registered.
    DuckDB is not thread-safe for writes, but we only do reads — safe for FastAPI.
    For multi-worker production: each Lambda invocation gets its own connection.
    """
    conn = duckdb.connect(database=":memory:", read_only=False)
    conn.execute("SET threads=4;")
    conn.execute("SET memory_limit='2GB';")
    _register_tables(conn)
    log.info("duckdb_ready", tables=TABLES)
    return conn


def execute_query(
    sql: str,
    conn: duckdb.DuckDBPyConnection | None = None,
    timeout_seconds: int = 30,
) -> list[dict]:
    """
    Execute a SELECT-only SQL query and return list of dicts.
    Raises ValueError for non-SELECT or timeout.
    """
    import sqlglot

    # Safety: parse and ensure SELECT-only
    try:
        parsed = sqlglot.parse_one(sql, dialect="duckdb")
    except Exception as exc:
        raise ValueError(f"SQL parse error: {exc}") from exc

    if parsed.key not in ("select", "union"):
        raise ValueError(f"Only SELECT queries allowed; got: {parsed.key}")

    if conn is None:
        conn = get_db_engine()

    result = conn.execute(sql).fetchdf()
    return result.to_dict(orient="records")
