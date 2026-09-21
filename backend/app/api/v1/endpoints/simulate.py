"""Scenario simulator — what-if Monte Carlo engine."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class SimulationRequest(BaseModel):
    premium_change_pct: float = 0.0        # -20 to +30%
    deductible_change_pct: float = 0.0    # 0 to +50%
    fraud_reduction_pct: float = 0.0      # 0 to 80%
    settlement_reduction_days: int = 0    # 0 to 30 days
    catastrophe_severity: float = 0.0     # 0=none, 1=1-in-10, 2=1-in-50

    base_gwp_cr: float = 842.5
    base_loss_ratio: float = 0.702
    base_combined_ratio: float = 1.002
    n_simulations: int = 10_000


class SimulationResult(BaseModel):
    mean_loss_ratio: float
    p10_loss_ratio: float
    p90_loss_ratio: float
    mean_combined_ratio: float
    net_impact_cr: float
    fraud_leakage_saved_cr: float
    settlement_efficiency_saved_cr: float
    tornado_sensitivity: List[dict]
    distribution: List[float]  # 100-bucket histogram
    insight: str
    ai_badge: str = "AI Analytical Insight — Not a Final Decision"


@router.post("", response_model=SimulationResult)
async def simulate(body: SimulationRequest) -> SimulationResult:
    """
    Monte Carlo scenario simulation (10k runs).
    Models impact of premium, deductible, fraud reduction, and catastrophe scenarios.
    """
    rng = np.random.default_rng(42)

    base_lr = body.base_loss_ratio
    base_gwp = body.base_gwp_cr * 1e7  # Convert to INR

    # 10k simulations
    n = body.n_simulations

    # Random loss ratio draws (log-normal around base)
    lr_samples = rng.lognormal(
        mean=np.log(base_lr) - 0.02**2 / 2,
        sigma=0.08,
        size=n,
    )

    # Premium change effect: higher premium → lower loss ratio
    premium_effect = -body.premium_change_pct / 100 * 0.6
    lr_samples += premium_effect

    # Deductible effect: higher deductible → lower claims
    deductible_effect = -body.deductible_change_pct / 100 * 0.3
    lr_samples += deductible_effect

    # Fraud reduction: direct leakage recovery
    fraud_exposure_cr = 28.0  # from KPI
    fraud_saved_cr = fraud_exposure_cr * body.fraud_reduction_pct / 100
    fraud_lr_effect = -fraud_saved_cr * 1e7 / max(base_gwp, 1)
    lr_samples += fraud_lr_effect

    # Settlement efficiency savings
    baseline_settlement_days = 38.4
    if body.settlement_reduction_days > 0:
        settlement_saving_pct = body.settlement_reduction_days / baseline_settlement_days * 0.05
        lr_samples -= settlement_saving_pct
    settlement_saved_cr = (body.settlement_reduction_days / baseline_settlement_days
                           * 12.0)  # ₹12 Cr from analyst time savings

    # Catastrophe scenarios
    if body.catastrophe_severity > 0:
        cat_prob = {1: 0.10, 2: 0.02}.get(int(body.catastrophe_severity), 0.05)
        cat_severity_cr = {1: 150.0, 2: 650.0}.get(int(body.catastrophe_severity), 300.0)
        cat_hits = rng.random(n) < cat_prob
        lr_samples += cat_hits * (cat_severity_cr * 1e7 / max(base_gwp, 1))

    # Compute statistics
    mean_lr = float(np.mean(lr_samples))
    p10_lr = float(np.percentile(lr_samples, 10))
    p90_lr = float(np.percentile(lr_samples, 90))
    mean_cr = mean_lr + 0.32  # expense ratio constant

    net_impact_cr = round((base_lr - mean_lr) * body.base_gwp_cr, 2)

    # Tornado sensitivity analysis
    drivers = [
        ("Premium Change", round(abs(premium_effect * body.base_gwp_cr), 2)),
        ("Fraud Reduction", round(fraud_saved_cr, 2)),
        ("Deductible Change", round(abs(deductible_effect * body.base_gwp_cr), 2)),
        ("Settlement Efficiency", round(settlement_saved_cr, 2)),
        ("Catastrophe Exposure", round(body.catastrophe_severity * 80.0, 2)),
    ]
    tornado = [{"driver": d[0], "impact_cr": d[1]} for d in
               sorted(drivers, key=lambda x: -abs(x[1]))]

    # 100-bucket histogram of loss ratio distribution
    hist, _ = np.histogram(lr_samples, bins=100, range=(0.4, 1.2))
    distribution = [float(h) / n for h in hist]

    # Insight
    direction = "improve" if net_impact_cr > 0 else "worsen"
    insight = (
        f"Under these assumptions, the portfolio loss ratio is projected at "
        f"{mean_lr*100:.1f}% (P10: {p10_lr*100:.1f}%, P90: {p90_lr*100:.1f}%). "
        f"Combined ratio: {mean_cr*100:.1f}%. "
        f"Net financial impact: {'savings of' if net_impact_cr > 0 else 'cost of'} "
        f"₹{abs(net_impact_cr):.1f} Cr vs. baseline. "
        f"Fraud reduction of {body.fraud_reduction_pct:.0f}% alone could recover ₹{fraud_saved_cr:.1f} Cr."
    )

    return SimulationResult(
        mean_loss_ratio=round(mean_lr, 4),
        p10_loss_ratio=round(p10_lr, 4),
        p90_loss_ratio=round(p90_lr, 4),
        mean_combined_ratio=round(mean_cr, 4),
        net_impact_cr=net_impact_cr,
        fraud_leakage_saved_cr=round(fraud_saved_cr, 2),
        settlement_efficiency_saved_cr=round(settlement_saved_cr, 2),
        tornado_sensitivity=tornado,
        distribution=distribution,
        insight=insight,
    )
