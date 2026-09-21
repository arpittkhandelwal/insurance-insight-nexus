"""Audit log endpoint — every query, SQL, decision tracked."""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
import uuid

router = APIRouter()
_AUDIT_LOG: List[dict] = []


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    user: str = "demo_user"
    action: str
    resource: str
    detail: str
    ip: str = "127.0.0.1"


@router.get("", response_model=List[AuditEntry])
async def get_audit_log(
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50),
) -> List[AuditEntry]:
    entries = _AUDIT_LOG or _demo_audit_log()
    if action:
        entries = [e for e in entries if e["action"] == action]
    offset = (page - 1) * page_size
    return [AuditEntry(**e) for e in entries[offset:offset + page_size]]


@router.post("/log")
async def log_event(action: str, resource: str, detail: str, user: str = "demo_user") -> dict:
    _AUDIT_LOG.append({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "user": user,
        "action": action,
        "resource": resource,
        "detail": detail,
        "ip": "127.0.0.1",
    })
    return {"status": "logged"}


def _demo_audit_log() -> List[dict]:
    actions = [
        ("nl_query", "ask_nexus", "Q: Why did motor claims spike in Kerala in July 2022?"),
        ("case_decision", "CASE-FRAUD001", "Approved SIU investigation — analyst: Kumar"),
        ("export", "anomaly_report", "Exported anomaly report for Q2 2024"),
        ("login", "auth", "User executive@insurenexus.com logged in"),
        ("briefing_generated", "briefing", "Monthly board briefing generated"),
        ("fraud_score_batch", "fraud", "Batch scored 5,000 Motor claims"),
    ]
    entries = []
    for i, (action, resource, detail) in enumerate(actions):
        entries.append({
            "id": f"AUD-{i:06d}",
            "timestamp": f"2024-07-{15-i:02d}T{10+i:02d}:00:00",
            "user": "demo_user",
            "action": action,
            "resource": resource,
            "detail": detail,
            "ip": "192.168.1.100",
        })
    return entries
