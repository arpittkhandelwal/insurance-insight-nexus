"""
Case management endpoint — investigation queue with human-in-the-loop signoff.
Every AI recommendation requires human Approve/Reject/Escalate.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

# In-memory store (DynamoDB in production)
_CASES: Dict[str, dict] = {}


class CaseCreateRequest(BaseModel):
    claim_id: str
    title: str
    description: str
    ai_recommendation: str
    risk_score: float
    priority: str = "high"
    assigned_to: Optional[str] = None


class CaseDecision(BaseModel):
    decision: str  # approve | reject | escalate
    reason: str
    decided_by: str


class Case(BaseModel):
    case_id: str
    claim_id: str
    title: str
    description: str
    ai_recommendation: str
    ai_badge: str = "AI Analytical Insight — Not a Final Decision"
    risk_score: float
    priority: str
    status: str = "open"
    assigned_to: Optional[str] = None
    created_at: str
    decision: Optional[str] = None
    decision_reason: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    notes: List[str] = []


@router.post("", response_model=Case, status_code=201)
async def create_case(body: CaseCreateRequest) -> Case:
    """Create an investigation case from an anomaly or fraud alert."""
    case_id = f"CASE-{str(uuid.uuid4())[:8].upper()}"
    case = Case(
        case_id=case_id,
        claim_id=body.claim_id,
        title=body.title,
        description=body.description,
        ai_recommendation=body.ai_recommendation,
        risk_score=body.risk_score,
        priority=body.priority,
        status="open",
        assigned_to=body.assigned_to,
        created_at=datetime.utcnow().isoformat(),
    )
    _CASES[case_id] = case.model_dump()
    return case


@router.get("", response_model=List[Case])
async def list_cases(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> List[Case]:
    """List investigation cases with filters."""
    cases = list(_CASES.values())
    if status:
        cases = [c for c in cases if c["status"] == status]
    if priority:
        cases = [c for c in cases if c["priority"] == priority]

    # Seed with demo cases if empty
    if not cases:
        cases = _demo_cases()

    offset = (page - 1) * page_size
    return [Case(**c) for c in cases[offset:offset + page_size]]


@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: str) -> Case:
    if case_id not in _CASES:
        raise HTTPException(status_code=404, detail="Case not found")
    return Case(**_CASES[case_id])


import os
import boto3

def _log_audit_decision(case_id: str, decision: CaseDecision):
    if os.environ.get("ENVIRONMENT") == "local":
        return
    try:
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "ap-south-1"))
        table = dynamodb.Table("InsureNexus-AuditLog")
        table.put_item(
            Item={
                "pk": f"CASE#{case_id}",
                "sk": f"DECISION#{datetime.utcnow().isoformat()}",
                "decision": decision.decision,
                "reason": decision.reason,
                "decided_by": decision.decided_by,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        import structlog
        log = structlog.get_logger()
        log.error("audit_log_failed", error=str(e), case_id=case_id)

@router.post("/{case_id}/decide", response_model=Case)
async def decide_case(case_id: str, decision: CaseDecision) -> Case:
    """
    Human-in-the-loop sign-off.
    Analyst must provide Approve/Reject/Escalate + reason.
    This is logged to the audit trail.
    """
    if case_id not in _CASES:
        # Create stub from demo
        demo = next((c for c in _demo_cases() if c["case_id"] == case_id), None)
        if not demo:
            raise HTTPException(status_code=404, detail="Case not found")
        _CASES[case_id] = demo

    case = _CASES[case_id]

    if decision.decision not in ("approve", "reject", "escalate"):
        raise HTTPException(status_code=400, detail="Invalid decision")

    case["decision"] = decision.decision
    case["decision_reason"] = decision.reason
    case["decided_by"] = decision.decided_by
    case["decided_at"] = datetime.utcnow().isoformat()
    case["status"] = "resolved" if decision.decision in ("approve", "reject") else "escalated"
    _CASES[case_id] = case
    
    # Write to DynamoDB audit log
    _log_audit_decision(case_id, decision)
    
    return Case(**case)


@router.post("/{case_id}/notes")
async def add_note(case_id: str, note: str = Body(..., embed=True)) -> dict:
    if case_id not in _CASES:
        raise HTTPException(status_code=404, detail="Case not found")
    _CASES[case_id]["notes"].append(f"{datetime.utcnow().isoformat()}: {note}")
    return {"status": "ok"}


def _demo_cases() -> List[dict]:
    return [
        {
            "case_id": "CASE-FRAUD001",
            "claim_id": "CLM000001",
            "title": "Motor Fraud Ring — Garage GRG0001 cluster",
            "description": "847 claims linked to 5 garages and 3 surveyors with shared customer identifiers.",
            "ai_recommendation": "De-panel GRG0001–GRG0005. Refer 120 customers to SIU. Estimated recovery ₹8.1 Cr.",
            "ai_badge": "AI Analytical Insight — Not a Final Decision",
            "risk_score": 94.0,
            "priority": "critical",
            "status": "open",
            "assigned_to": "Analyst Kumar",
            "created_at": "2024-07-15T09:30:00",
            "decision": None,
            "decision_reason": None,
            "decided_by": None,
            "decided_at": None,
            "notes": [],
        },
        {
            "case_id": "CASE-HOSP001",
            "claim_id": "CLM000050",
            "title": "Health — Hospital Upcoding Anomaly",
            "description": "HSP0001 billing 2.4x peer average for standard hospitalisation procedures.",
            "ai_recommendation": "Conduct desk audit of 342 claims. Request procedure-level breakdowns.",
            "ai_badge": "AI Analytical Insight — Not a Final Decision",
            "risk_score": 82.0,
            "priority": "high",
            "status": "open",
            "assigned_to": "Analyst Sharma",
            "created_at": "2024-07-14T14:00:00",
            "decision": None,
            "decision_reason": None,
            "decided_by": None,
            "decided_at": None,
            "notes": [],
        },
        {
            "case_id": "CASE-CROP001",
            "claim_id": "CLM000100",
            "title": "Crop/Rajasthan — Loss Ratio Deterioration",
            "description": "Loss ratio for Crop in Rajasthan reached 91.2% — above 85% trigger threshold.",
            "ai_recommendation": "Immediate reserve top-up of ₹15 Cr. Underwriting review for next renewal.",
            "ai_badge": "AI Analytical Insight — Not a Final Decision",
            "risk_score": 71.0,
            "priority": "high",
            "status": "open",
            "assigned_to": None,
            "created_at": "2024-07-13T10:00:00",
            "decision": None,
            "decision_reason": None,
            "decided_by": None,
            "decided_at": None,
            "notes": [],
        },
    ]
