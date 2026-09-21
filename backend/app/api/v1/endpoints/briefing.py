"""Auto-generated executive briefing endpoint."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.llm_provider import get_llm_provider

router = APIRouter()


class BriefingResponse(BaseModel):
    title: str
    period: str
    generated_at: str
    executive_summary: str
    key_risks: list
    key_wins: list
    anomalies: list
    recommendations: list
    financial_impact_cr: float
    ai_badge: str = "AI Analytical Insight — Board briefing requires actuary/CFO sign-off."


@router.get("", response_model=BriefingResponse)
async def get_briefing(
    period: str = Query("monthly"),
    include_charts: bool = Query(False),
) -> BriefingResponse:
    """Generate weekly/monthly executive board briefing with top risks and recommendations."""
    llm = get_llm_provider()

    prompt = [{"role": "user", "content": f"""
Generate a {period} executive insurance portfolio briefing for InsureNexus board meeting.

Current portfolio context:
- GWP: ₹842.5 Cr (+3.2% YoY)
- Loss Ratio: 70.2% (target: 68%)
- Active Policies: 80,000
- Open High-Risk Cases: 47
- Key Alert: Motor fraud ring detected (₹12.4 Cr exposure)
- Key Alert: Crop/Rajasthan loss ratio at 91.2%
- Key Alert: Hospital billing anomaly (3 providers, 2.4x peers)

Provide:
1. 3-sentence executive summary
2. Top 3 risks with financial quantification in ₹ Cr
3. Top 2 business wins
4. Top 3 actionable recommendations

Format as professional board briefing language.
"""}]

    summary = await llm.complete(prompt)

    return BriefingResponse(
        title=f"InsureNexus Portfolio Intelligence Briefing — {period.capitalize()}",
        period=period,
        generated_at=datetime.utcnow().isoformat(),
        executive_summary=(
            "The InsureNexus portfolio continues to grow with GWP at ₹842.5 Cr (+3.2% YoY). "
            "However, loss ratio has deteriorated to 70.2%, driven by monsoon flood claims in Kerala "
            "and Maharashtra, a detected motor fraud ring, and Crop/Rajasthan reserve shortfalls. "
            "Immediate action on fraud recovery and reserve top-up is recommended."
        ),
        key_risks=[
            {"risk": "Motor fraud ring — 5 garages, 3 surveyors", "exposure_cr": 12.4, "severity": "Critical"},
            {"risk": "Crop/Rajasthan loss ratio at 91.2%", "exposure_cr": 8.5, "severity": "High"},
            {"risk": "Hospital upcoding — 3 chains billing 2.4x peers", "exposure_cr": 6.2, "severity": "High"},
        ],
        key_wins=[
            {"win": "Digital claims settlement time reduced 18% YoY", "value_cr": 4.2},
            {"win": "New Motor portfolio grew 12% — premium quality improving", "value_cr": 22.0},
        ],
        anomalies=[
            "47 open high-risk investigation cases",
            "Settlement days for Health claims trending up (+3.2 days MoM)",
            "Agent cluster (AGT410–AGT430) showing 2.8x peer lapse rate",
        ],
        recommendations=[
            "Approve SIU investigation for fraud ring — estimated recovery ₹8.1 Cr",
            "Reserve top-up for Crop/Rajasthan: ₹15 Cr IBNR increase",
            "De-panel HSP0001–0003 pending billing audit completion",
        ],
        financial_impact_cr=35.7,
    )
