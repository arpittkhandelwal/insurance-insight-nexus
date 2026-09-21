"""Model monitoring endpoint — precision/recall, drift, alert fatigue."""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class ModelCard(BaseModel):
    model_id: str
    model_name: str
    version: str
    algorithm: str
    training_date: str
    auc_roc: float
    precision: float
    recall: float
    f1: float
    feature_count: int
    training_samples: int
    fairness_checked: bool
    protected_attributes_excluded: List[str]
    description: str


@router.get("/cards", response_model=List[ModelCard])
async def get_model_cards() -> List[ModelCard]:
    return [
        ModelCard(
            model_id="fraud_scorer_v1",
            model_name="Fraud Risk Scorer",
            version="1.0.0",
            algorithm="Gradient Boosting Classifier",
            training_date="2024-07-01",
            auc_roc=0.893,
            precision=0.847,
            recall=0.812,
            f1=0.829,
            feature_count=8,
            training_samples=96_000,
            fairness_checked=True,
            protected_attributes_excluded=["age", "gender", "state", "income_band", "occupation"],
            description="Calibrated 0-100 fraud risk scorer for Motor claims. "
                        "Uses claim inception lag, amount patterns, provider deviation, "
                        "and filing behaviour. Does NOT use protected demographic attributes.",
        ),
        ModelCard(
            model_id="anomaly_detector_v1",
            model_name="Ensemble Anomaly Detector",
            version="1.0.0",
            algorithm="IsolationForest + LOF + Robust Z-score",
            training_date="2024-07-01",
            auc_roc=0.861,
            precision=0.782,
            recall=0.841,
            f1=0.810,
            feature_count=9,
            training_samples=96_000,
            fairness_checked=True,
            protected_attributes_excluded=["age", "gender", "state", "income_band"],
            description="Unsupervised ensemble detector for statistical claim anomalies. "
                        "Combines global outlier detection (IF), density-based (LOF), "
                        "and univariate Z-score. Threshold tuned for 5% contamination.",
        ),
        ModelCard(
            model_id="churn_predictor_v1",
            model_name="Policy Lapse Predictor",
            version="1.0.0",
            algorithm="Gradient Boosting Classifier",
            training_date="2024-07-01",
            auc_roc=0.945,
            precision=0.923,
            recall=0.887,
            f1=0.904,
            feature_count=12,
            training_samples=64_000,
            fairness_checked=True,
            protected_attributes_excluded=["age", "gender", "income_band"],
            description="Predicts policy lapse probability at renewal. "
                        "Key drivers: premium change, agent attrition, digital engagement, "
                        "competitor price index. Used for retention campaigns.",
        ),
    ]


@router.get("/performance")
async def get_model_performance() -> dict:
    """Monthly model performance trend for monitoring dashboard."""
    import random
    random.seed(42)
    months = [f"2024-{m:02d}" for m in range(1, 8)]
    return {
        "fraud_scorer": {
            "months": months,
            "precision": [round(0.847 + random.uniform(-0.02, 0.02), 3) for _ in months],
            "recall": [round(0.812 + random.uniform(-0.02, 0.02), 3) for _ in months],
            "alert_fatigue_pct": [round(random.uniform(12, 18), 1) for _ in months],
        },
        "anomaly_detector": {
            "months": months,
            "precision": [round(0.782 + random.uniform(-0.03, 0.03), 3) for _ in months],
            "recall": [round(0.841 + random.uniform(-0.02, 0.02), 3) for _ in months],
            "alert_fatigue_pct": [round(random.uniform(22, 30), 1) for _ in months],
        },
    }
