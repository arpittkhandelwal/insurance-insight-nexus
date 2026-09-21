"""
Insurance Insight Nexus — FastAPI Application Entry Point
=========================================================
Runs as:
  • uvicorn app.main:app   (local dev)
  • Lambda via Mangum      (AWS)
"""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from app.core.config import settings
from app.core.database import get_db_engine
from app.core.logging import configure_logging
from app.api.v1.router import api_router

configure_logging()
log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialise DuckDB engine and ML models on startup."""
    log.info("startup", env=settings.ENVIRONMENT, llm_provider=settings.LLM_PROVIDER)
    engine = get_db_engine()
    app.state.db = engine
    # Pre-warm ML models
    from app.ml.anomaly import AnomalyDetector
    from app.ml.fraud_scorer import FraudScorer
    app.state.anomaly_detector = AnomalyDetector()
    app.state.fraud_scorer = FraudScorer()
    await app.state.fraud_scorer.ensure_trained()
    log.info("startup_complete", db_tables=engine.execute("SHOW TABLES").fetchall())
    yield
    log.info("shutdown")


app = FastAPI(
    title="Insurance Insight Nexus API",
    description="Cloud-native intelligence platform for insurance analytics",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
cors_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if not cors_origins and settings.ENVIRONMENT == "local":
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next) -> Response:
    """Attach unique request ID to every request for tracing."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.bind_contextvars(request_id=request_id)
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    log.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
    structlog.contextvars.clear_contextvars()
    return response


# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(api_router, prefix="/api/v1")



@app.get("/api/health", tags=["ops"])
async def health(request: Request) -> dict:
    from app.services.llm_provider import get_llm_provider
    provider = get_llm_provider()
    provider_name = getattr(provider, 'current_provider_name', provider.__class__.__name__)
    
    rows = {}
    try:
        if hasattr(request.app.state, "db"):
            for table in ["claims", "policies", "kpi_snapshots"]:
                try:
                    count = request.app.state.db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                    rows[table] = count
                except Exception:
                    pass
    except Exception:
        pass

    return {
        "status": "ok", 
        "version": "1.0.0", 
        "env": settings.ENVIRONMENT,
        "provider": provider_name.replace("LLMProvider", "").replace("Provider", "").lower(),
        "rows": rows
    }


@app.get("/ready", tags=["ops"])
async def ready(request: Request) -> dict:
    try:
        request.app.state.db.execute("SELECT 1").fetchone()
        return {"status": "ready"}
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": str(exc)})


# ── AWS Lambda handler ────────────────────────────────────────────────────────
handler = Mangum(app, lifespan="on")
