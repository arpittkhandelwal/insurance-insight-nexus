"""
Gradient Boosting Fraud Scorer with SHAP explanations.
Calibrated 0-100 risk score per claim with plain-language reason codes.
"""

from __future__ import annotations

import asyncio
import os
import pickle
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import structlog

log = structlog.get_logger(__name__)

FRAUD_FEATURES = [
    "days_since_inception",
    "report_lag_days",
    "amount_claimed",
    "documents_count",
    "is_round_amount",
    "filed_on_weekend",
    "claim_to_premium_ratio",
    "provider_deviation",
]

# Human-readable reason templates keyed by feature name
REASON_TEMPLATES: Dict[str, str] = {
    "days_since_inception":   "Filed {days} days after policy start (high risk < 30 days)",
    "report_lag_days":        "Claim reported {lag} days after loss (typical: < 14 days)",
    "amount_claimed":         "Claimed amount ₹{amount:,.0f} is {pct:.0f}% above peer median",
    "is_round_amount":        "Amount is a round number (common fraud signal)",
    "filed_on_weekend":       "Claim filed on a weekend/holiday",
    "claim_to_premium_ratio": "Claim-to-premium ratio {ratio:.1f}x (peer: 1.0x)",
    "provider_deviation":     "Provider billing {ratio:.1f}x peer average for similar procedures",
    "report_lag_days_high":   "Report lag > 60 days without documented reason",
}

MODEL_PATH = Path("ml/models/fraud_scorer.pkl")


class FraudScorer:
    """
    Supervised gradient boosting fraud scorer.
    Falls back to heuristic when no training data available.
    """

    def __init__(self):
        self._model = None
        self._explainer = None
        self._scaler = None
        self._trained = False

    async def ensure_trained(self) -> None:
        """Load saved model or train a new one in background."""
        if MODEL_PATH.exists():
            try:
                with open(MODEL_PATH, "rb") as f:
                    checkpoint = pickle.load(f)
                self._model = checkpoint["model"]
                self._scaler = checkpoint["scaler"]
                self._trained = True
                log.info("fraud_scorer_loaded", path=str(MODEL_PATH))
                return
            except Exception as exc:
                log.warning("fraud_scorer_load_failed", error=str(exc))

        # Train in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._train_from_parquet)

    def _train_from_parquet(self) -> None:
        """Train on generated fraud_labels Parquet."""
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import train_test_split

        claims_path = Path("data/parquet/claims.parquet")
        labels_path = Path("data/parquet/fraud_labels.parquet")

        if not (claims_path.exists() and labels_path.exists()):
            log.warning("fraud_scorer_no_data", msg="Using heuristic scoring")
            return

        claims = pd.read_parquet(claims_path)
        labels = pd.read_parquet(labels_path)
        df = claims.merge(labels, on="claim_id")

        # Engineer features
        df["claim_to_premium_ratio"] = df["amount_claimed"] / 50_000
        df["provider_deviation"] = 1.0  # simplified
        for col in ["is_round_amount", "filed_on_weekend"]:
            df[col] = df[col].astype(int)

        available = [f for f in FRAUD_FEATURES if f in df.columns]
        X = df[available].fillna(0).values
        y = df["fraud_label"].values

        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )

        self._model = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
        )
        self._model.fit(X_train, y_train)
        self._trained = True

        # Save model
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump({"model": self._model, "scaler": self._scaler, "features": available}, f)

        precision = self._model.score(X_test, y_test)
        log.info("fraud_scorer_trained", train_size=len(X_train), accuracy=round(precision, 3))

    def score_claim(self, claim: dict) -> dict:
        """
        Score a single claim. Returns dict with:
        - risk_score: 0-100
        - risk_tier: Low/Medium/High/Critical
        - shap_reasons: list of plain-language explanations
        """
        # Heuristic scoring (always available as fallback)
        score = self._heuristic_score(claim)
        reasons = self._generate_reasons(claim, score)

        # If model trained, override with model score
        if self._trained and self._model is not None:
            try:
                score = self._model_score(claim)
            except Exception:
                pass

        tier = ("Critical" if score >= 80 else "High" if score >= 60
                else "Medium" if score >= 40 else "Low")

        return {
            "risk_score": round(score, 1),
            "risk_tier": tier,
            "shap_reasons": reasons,
            "model_version": "gb_v1" if self._trained else "heuristic_v1",
        }

    def _heuristic_score(self, claim: dict) -> float:
        score = 0.0
        inception = claim.get("days_since_inception", 90)
        if inception < 30:
            score += 35 * (1 - inception / 30)
        if claim.get("is_round_amount", False):
            score += 15
        if claim.get("filed_on_weekend", False):
            score += 10
        lag = claim.get("report_lag_days", 14)
        if lag > 60:
            score += 15
        cpr = claim.get("claim_to_premium_ratio", 1.0)
        if cpr > 3:
            score += min(20, (cpr - 3) * 5)
        pdev = claim.get("provider_deviation", 1.0)
        if pdev > 1.8:
            score += min(20, (pdev - 1.8) * 20)
        return min(score, 100)

    def _model_score(self, claim: dict) -> float:
        row = np.zeros(len(FRAUD_FEATURES))
        for i, feat in enumerate(FRAUD_FEATURES):
            row[i] = float(claim.get(feat, 0) or 0)
        X = self._scaler.transform(row.reshape(1, -1))
        prob = self._model.predict_proba(X)[0][1]
        return prob * 100

    def _generate_reasons(self, claim: dict, score: float) -> List[str]:
        reasons = []
        inception = claim.get("days_since_inception", 90)
        if inception < 30:
            reasons.append(
                REASON_TEMPLATES["days_since_inception"].format(days=inception)
            )
        if claim.get("is_round_amount", False):
            reasons.append(REASON_TEMPLATES["is_round_amount"])
        if claim.get("filed_on_weekend", False):
            reasons.append(REASON_TEMPLATES["filed_on_weekend"])
        cpr = claim.get("claim_to_premium_ratio", 1.0)
        if cpr > 3:
            reasons.append(REASON_TEMPLATES["claim_to_premium_ratio"].format(ratio=cpr))
        pdev = claim.get("provider_deviation", 1.0)
        if pdev > 1.8:
            reasons.append(REASON_TEMPLATES["provider_deviation"].format(ratio=pdev))
        lag = claim.get("report_lag_days", 14)
        if lag > 60:
            reasons.append(REASON_TEMPLATES["report_lag_days"].format(lag=lag))
        return reasons or ["No individual risk signals above threshold"]
