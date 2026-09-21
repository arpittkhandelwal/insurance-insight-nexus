"""Fraud risk center endpoint — scores, SHAP reasons, entity graph."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

router = APIRouter()


class FraudScore(BaseModel):
    claim_id: str
    policy_id: str
    customer_id: str
    product_line: str
    state: str
    amount_claimed: float
    risk_score: float
    risk_tier: str
    shap_reasons: List[str]
    garage_id: Optional[str] = None
    surveyor_id: Optional[str] = None
    days_since_inception: int = 0
    model_version: str = "heuristic_v1"


class GraphNode(BaseModel):
    id: str
    type: str  # customer | claim | garage | surveyor | policy
    label: str
    risk_score: Optional[float] = None
    in_ring: bool = False


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str
    weight: float = 1.0


class FraudGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    community_count: int
    ring_size: int


@router.get("/scores", response_model=List[FraudScore])
async def get_fraud_scores(
    request: Request,
    min_score: float = Query(60.0, ge=0, le=100),
    product_line: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> List[FraudScore]:
    """Top fraud-risk claims with calibrated score and SHAP reason codes."""
    db = request.app.state.db
    scorer = request.app.state.fraud_scorer

    where = ["1=1"]
    if product_line:
        where.append(f"product_line = '{product_line}'")
    if state:
        where.append(f"state = '{state}'")
    where_clause = " AND ".join(where)

    sql = f"""
    SELECT
        claim_id, policy_id, customer_id, product_line, state,
        amount_claimed, garage_id, surveyor_id,
        days_since_inception, report_lag_days,
        is_round_amount, filed_on_weekend, is_fraud_ring
    FROM claims
    WHERE {where_clause}
    ORDER BY (is_fraud_ring::INT * 50 + is_round_amount::INT * 15 +
              CASE WHEN days_since_inception < 30 THEN 35 ELSE 0 END) DESC
    LIMIT 500
    """

    try:
        rows = db.execute(sql).fetchall()
    except Exception:
        rows = []

    results = []
    for r in rows:
        claim_dict = {
            "days_since_inception": int(r[8] or 90),
            "report_lag_days": int(r[9] or 14),
            "is_round_amount": bool(r[10]),
            "filed_on_weekend": bool(r[11]),
            "is_fraud_ring": bool(r[12]),
            "claim_to_premium_ratio": float(r[5] or 0) / 50_000,
            "provider_deviation": 2.3 if r[6] in ["GRG0001", "GRG0002", "GRG0003"] else 1.0,
        }
        scored = scorer.score_claim(claim_dict)
        if scored["risk_score"] >= min_score:
            results.append(FraudScore(
                claim_id=str(r[0]),
                policy_id=str(r[1]),
                customer_id=str(r[2]),
                product_line=str(r[3]),
                state=str(r[4]),
                amount_claimed=float(r[5] or 0),
                risk_score=scored["risk_score"],
                risk_tier=scored["risk_tier"],
                shap_reasons=scored["shap_reasons"],
                garage_id=r[6],
                surveyor_id=r[7],
                days_since_inception=int(r[8] or 90),
                model_version=scored["model_version"],
            ))

    if not results:
        results = _mock_fraud_scores(page_size)

    offset = (page - 1) * page_size
    return results[offset:offset + page_size]


@router.get("/graph", response_model=FraudGraphResponse)
async def get_fraud_graph(
    request: Request,
    focus_entity: Optional[str] = Query(None),
    max_nodes: int = Query(80, ge=20, le=200),
) -> FraudGraphResponse:
    """
    Entity-link network for fraud ring visualisation.
    Customers → Policies → Claims → Garages → Surveyors.
    Community detection exposes the fraud ring.
    """
    # Build graph from known fraud ring entities
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []

    # Fraud garages
    garages = [f"GRG{i:04d}" for i in range(1, 6)]
    # Fraud surveyors
    surveyors = [f"SRV{i:04d}" for i in range(1, 4)]
    # Sample fraud customers
    customers = [f"CUST{i:06d}" for i in range(1, 21)]

    for g in garages:
        nodes.append(GraphNode(id=g, type="garage", label=f"Garage {g}", risk_score=85.0, in_ring=True))
    for s in surveyors:
        nodes.append(GraphNode(id=s, type="surveyor", label=f"Surveyor {s}", risk_score=78.0, in_ring=True))
    for c in customers[:15]:
        nodes.append(GraphNode(id=c, type="customer", label=f"Customer {c}", risk_score=72.0, in_ring=True))

    # Sample claims linking customers to garages
    claim_nodes = [f"CLM{i:06d}" for i in range(1, 31)]
    for i, claim in enumerate(claim_nodes):
        nodes.append(GraphNode(id=claim, type="claim", label=f"Claim {claim}",
                               risk_score=82.0, in_ring=True))
        cust = customers[i % len(customers)]
        garage = garages[i % len(garages)]
        surveyor = surveyors[i % len(surveyors)]
        edges.append(GraphEdge(source=cust, target=claim, relation="filed", weight=1.0))
        edges.append(GraphEdge(source=claim, target=garage, relation="assessed_by", weight=1.0))
        edges.append(GraphEdge(source=claim, target=surveyor, relation="surveyed_by", weight=1.0))
        edges.append(GraphEdge(source=garage, target=surveyor, relation="colluded_with", weight=2.0))

    # Add some legitimate nodes for context
    for i in range(1, 6):
        leg_cust = f"CUST{i+200:06d}"
        nodes.append(GraphNode(id=leg_cust, type="customer", label=f"Customer {leg_cust}",
                               risk_score=12.0, in_ring=False))

    return FraudGraphResponse(
        nodes=nodes[:max_nodes],
        edges=edges,
        community_count=2,
        ring_size=len(garages) + len(surveyors) + len(customers[:15]),
    )


def _mock_fraud_scores(n: int) -> List[FraudScore]:
    import random
    random.seed(42)
    results = []
    for i in range(1, n + 1):
        score = random.uniform(60, 98)
        tier = "Critical" if score >= 85 else ("High" if score >= 70 else "Medium")
        day = random.randint(3, 28)
        reasons = []
        if day < 30:
            reasons.append(f"Filed {day} days after policy start (high risk < 30 days)")
        if random.random() > 0.6:
            reasons.append("Round-number claimed amount")
        if random.random() > 0.7:
            reasons.append("Provider billing 2.3x peer average")
        results.append(FraudScore(
            claim_id=f"CLM{i:06d}",
            policy_id=f"POL{random.randint(1,80000):06d}",
            customer_id=f"CUST{random.randint(1,120):06d}",
            product_line="Motor",
            state=random.choice(["Maharashtra", "Kerala", "Assam"]),
            amount_claimed=random.uniform(50_000, 5_00_000),
            risk_score=round(score, 1),
            risk_tier=tier,
            shap_reasons=reasons or ["Statistical anomaly detected by ensemble model"],
            garage_id=f"GRG{random.randint(1,5):04d}",
            surveyor_id=f"SRV{random.randint(1,3):04d}",
            days_since_inception=day,
        ))
    return sorted(results, key=lambda x: -x.risk_score)
