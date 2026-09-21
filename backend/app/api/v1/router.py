"""Central v1 API router — wires all endpoint modules."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    kpis, timeseries, geo, claims, policies,
    anomalies, fraud, ask, cases, simulate,
    rag, briefing, audit, data_quality, models, admin, sarvam
)

api_router = APIRouter()

# Analytics
api_router.include_router(kpis.router,        prefix="/kpis",         tags=["kpis"])
api_router.include_router(timeseries.router,  prefix="/timeseries",   tags=["timeseries"])
api_router.include_router(geo.router,         prefix="/geo",          tags=["geo"])
api_router.include_router(claims.router,      prefix="/claims",       tags=["claims"])
api_router.include_router(policies.router,    prefix="/policies",     tags=["policies"])

# Intelligence
api_router.include_router(anomalies.router,   prefix="/anomalies",    tags=["anomalies"])
api_router.include_router(fraud.router,       prefix="/fraud",        tags=["fraud"])
api_router.include_router(ask.router,         prefix="/ask",          tags=["ask"])
api_router.include_router(rag.router,         prefix="/rag",          tags=["rag"])
api_router.include_router(sarvam.router,      prefix="/sarvam",       tags=["sarvam"])

# Operations
api_router.include_router(simulate.router,    prefix="/simulate",     tags=["simulate"])
api_router.include_router(cases.router,       prefix="/cases",        tags=["cases"])
api_router.include_router(briefing.router,    prefix="/briefing",     tags=["briefing"])

# Governance
api_router.include_router(audit.router,       prefix="/audit",        tags=["audit"])
api_router.include_router(data_quality.router,prefix="/data-quality", tags=["data-quality"])
api_router.include_router(models.router,      prefix="/models",       tags=["models"])
api_router.include_router(admin.router,       prefix="/admin",        tags=["admin"])
