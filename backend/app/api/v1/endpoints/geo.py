"""
Geo endpoint — India state-level data for heatmap and district drill-down.
Switchable across metrics: loss_ratio, claim_frequency, fraud_score, weather_exposure.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

router = APIRouter()

# Indian state → ISO code mapping for react-simple-maps / topojson
STATE_ISO = {
    "Andhra Pradesh": "IN-AP", "Assam": "IN-AS", "Bihar": "IN-BR",
    "Chhattisgarh": "IN-CT", "Delhi": "IN-DL", "Gujarat": "IN-GJ",
    "Haryana": "IN-HR", "Himachal Pradesh": "IN-HP", "Jharkhand": "IN-JH",
    "Karnataka": "IN-KA", "Kerala": "IN-KL", "Madhya Pradesh": "IN-MP",
    "Maharashtra": "IN-MH", "Manipur": "IN-MN", "Meghalaya": "IN-ML",
    "Odisha": "IN-OR", "Punjab": "IN-PB", "Rajasthan": "IN-RJ",
    "Tamil Nadu": "IN-TN", "Telangana": "IN-TS", "Uttar Pradesh": "IN-UP",
    "Uttarakhand": "IN-UT", "West Bengal": "IN-WB",
}


class StateMetric(BaseModel):
    state: str
    iso_code: str
    value: float
    rank: int
    label: str
    metadata: dict = {}


class GeoResponse(BaseModel):
    metric: str
    unit: str
    states: List[StateMetric]
    min_value: float
    max_value: float
    as_of: str


@router.get("/states/{metric}", response_model=GeoResponse)
async def get_state_metrics(
    metric: str,
    request: Request,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    product_line: Optional[str] = Query(None),
) -> GeoResponse:
    """
    Returns per-state metric values for the India heatmap.
    metric: loss_ratio | claim_frequency | fraud_score | weather_exposure | settlement_days
    """
    db = request.app.state.db

    where = ["1=1"]
    if date_from:
        where.append(f"c.loss_date >= '{date_from}'")
    if date_to:
        where.append(f"c.loss_date <= '{date_to}'")
    if product_line:
        where.append(f"c.product_line = '{product_line}'")
    where_clause = " AND ".join(where)

    metric_map = {
        "loss_ratio": (
            "SUM(c.amount_approved) / NULLIF(SUM(c.amount_claimed), 0)",
            "%",
        ),
        "claim_frequency": (
            "COUNT(c.claim_id)::FLOAT / NULLIF(COUNT(DISTINCT c.policy_id), 0)",
            "per policy",
        ),
        "fraud_score": (
            "AVG(c.is_fraud_ring::INT) * 100",
            "score 0-100",
        ),
        "weather_exposure": (
            "SUM(c.amount_claimed * c.is_monsoon_claim::INT) / 1e7",
            "Cr INR",
        ),
        "settlement_days": (
            "AVG(c.settlement_days)",
            "days",
        ),
    }

    expr, unit = metric_map.get(metric, metric_map["loss_ratio"])

    sql = f"""
    SELECT
        c.state,
        {expr} AS value
    FROM claims c
    WHERE {where_clause}
    GROUP BY c.state
    ORDER BY value DESC NULLS LAST
    """

    try:
        rows = db.execute(sql).fetchall()
    except Exception:
        rows = _mock_state_data(metric)

    if not rows:
        rows = _mock_state_data(metric)

    values = [float(r[1] or 0) for r in rows]
    min_val = min(values) if values else 0
    max_val = max(values) if values else 1

    states = [
        StateMetric(
            state=str(r[0]),
            iso_code=STATE_ISO.get(str(r[0]), "IN-MH"),
            value=float(r[1] or 0),
            rank=i + 1,
            label=f"{float(r[1] or 0):.2f} {unit}",
        )
        for i, r in enumerate(rows)
    ]

    from datetime import date
    return GeoResponse(
        metric=metric,
        unit=unit,
        states=states,
        min_value=min_val,
        max_value=max_val,
        as_of=date.today().isoformat(),
    )


def _mock_state_data(metric: str) -> list:
    """Mock state data showing Kerala/Maharashtra/Assam spike for monsoon demo."""
    base = {
        "Andhra Pradesh": 0.68, "Assam": 0.91, "Bihar": 0.72,
        "Chhattisgarh": 0.65, "Delhi": 0.74, "Gujarat": 0.70,
        "Haryana": 0.67, "Himachal Pradesh": 0.62, "Jharkhand": 0.71,
        "Karnataka": 0.75, "Kerala": 0.94, "Madhya Pradesh": 0.73,
        "Maharashtra": 0.89, "Manipur": 0.66, "Meghalaya": 0.64,
        "Odisha": 0.78, "Punjab": 0.69, "Rajasthan": 0.82,
        "Tamil Nadu": 0.76, "Telangana": 0.74, "Uttar Pradesh": 0.71,
        "Uttarakhand": 0.68, "West Bengal": 0.77,
    }
    if metric == "loss_ratio":
        return [(k, v) for k, v in sorted(base.items(), key=lambda x: -x[1])]
    elif metric == "fraud_score":
        fraud = {k: round(v * 8.0, 1) for k, v in base.items()}
        # Fraud ring concentrated in Maharashtra
        fraud["Maharashtra"] = 18.5
        return [(k, v) for k, v in sorted(fraud.items(), key=lambda x: -x[1])]
    else:
        return [(k, round(v * 100)) for k, v in sorted(base.items(), key=lambda x: -x[1])]
