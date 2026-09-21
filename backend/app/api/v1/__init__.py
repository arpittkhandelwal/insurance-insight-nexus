"""
API v1 — root router that assembles all sub-routers.
All routes are versioned under /api/v1.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    anomalies,
    ask,
    audit,
    briefing,
    cases,
    claims,
    data_quality,
    fraud,
    geo,
    kpis,
    models as model_endpoints,
    policies,
    rag,
    simulate,
    timeseries,
)

router = APIRouter()

router.include_router(kpis.router,        prefix="/kpis",         tags=["KPIs"])
router.include_router(timeseries.router,  prefix="/timeseries",   tags=["Timeseries"])
router.include_router(geo.router,         prefix="/geo",          tags=["Geo"])
router.include_router(claims.router,      prefix="/claims",       tags=["Claims"])
router.include_router(policies.router,    prefix="/policies",     tags=["Policies"])
router.include_router(anomalies.router,   prefix="/anomalies",    tags=["Anomalies"])
router.include_router(fraud.router,       prefix="/fraud",        tags=["Fraud"])
router.include_router(cases.router,       prefix="/cases",        tags=["Cases"])
router.include_router(ask.router,         prefix="/ask",          tags=["Ask Nexus"])
router.include_router(rag.router,         prefix="/rag",          tags=["RAG"])
router.include_router(simulate.router,    prefix="/simulate",     tags=["Simulator"])
router.include_router(briefing.router,    prefix="/briefing",     tags=["Briefing"])
router.include_router(audit.router,       prefix="/audit",        tags=["Audit"])
router.include_router(data_quality.router, prefix="/data-quality", tags=["Data Quality"])
router.include_router(model_endpoints.router, prefix="/models",   tags=["Model Monitoring"])
router.include_router(admin.router,       prefix="/admin",        tags=["Admin"])
