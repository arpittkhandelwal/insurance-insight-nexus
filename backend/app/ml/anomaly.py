"""
Ensemble Anomaly Detector — IsolationForest + LOF + robust Z-score.
Engineered features from claims data. Returns per-claim anomaly scores.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
import structlog

log = structlog.get_logger(__name__)

# Features used by the anomaly detector
ANOMALY_FEATURES = [
    "amount_claimed",
    "report_lag_days",
    "days_since_inception",
    "documents_count",
    "is_round_amount",
    "filed_on_weekend",
    "claim_to_premium_ratio",  # engineered
    "provider_deviation",      # engineered
    "frequency_burst",         # engineered (rolling 30d count per customer)
]


class AnomalyDetector:
    """
    Ensemble anomaly detector. Trained lazily on first call.
    Combines:
      - IsolationForest (global outliers)
      - LocalOutlierFactor (density-based)
      - Robust Z-score via IQR (univariate, fast)
    Final score = weighted average, 0-100 scale.
    """

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination
        self.iso = IsolationForest(
            n_estimators=200,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.lof = LocalOutlierFactor(
            n_neighbors=20,
            contamination=contamination,
            novelty=True,
            n_jobs=-1,
        )
        self.scaler = StandardScaler()
        self._fitted = False

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add computed fraud/anomaly signals."""
        result = df.copy()

        # Claim-to-premium ratio (requires join with policies)
        if "annual_premium" in df.columns:
            result["claim_to_premium_ratio"] = (
                df["amount_claimed"] / df["annual_premium"].replace(0, np.nan)
            ).clip(0, 50)
        else:
            result["claim_to_premium_ratio"] = df["amount_claimed"] / 50_000

        # Provider deviation (if provider avg billing available)
        if "provider_avg_billing" in df.columns and "peer_avg_billing" in df.columns:
            result["provider_deviation"] = (
                df["provider_avg_billing"] / df["peer_avg_billing"].replace(0, np.nan)
            ).clip(0, 10).fillna(1.0)
        else:
            result["provider_deviation"] = 1.0

        # Frequency burst (approximation without rolling window)
        result["frequency_burst"] = (df["days_since_inception"] < 30).astype(int) * 2

        # Ensure boolean columns are numeric
        for col in ["is_round_amount", "filed_on_weekend"]:
            if col in result.columns:
                result[col] = result[col].astype(int)

        return result

    def fit(self, df: pd.DataFrame) -> None:
        """Fit all ensemble members."""
        features = self._engineer_features(df)
        available = [f for f in ANOMALY_FEATURES if f in features.columns]
        X = features[available].fillna(0).values

        X_scaled = self.scaler.fit_transform(X)
        self.iso.fit(X_scaled)
        self.lof.fit(X_scaled)
        self._fitted = True
        log.info("anomaly_detector_fitted", n_samples=len(df), features=available)

    def score(self, df: pd.DataFrame) -> np.ndarray:
        """
        Return anomaly scores in [0, 100]. Higher = more anomalous.
        Works even if not explicitly fitted (uses heuristic scoring).
        """
        if not self._fitted:
            return self._heuristic_score(df)

        features = self._engineer_features(df)
        available = [f for f in ANOMALY_FEATURES if f in features.columns]
        X = features[available].fillna(0).values
        X_scaled = self.scaler.transform(X)

        # IsolationForest: negative score → anomaly (range -1 to 1 mapped to 0-100)
        iso_raw = -self.iso.score_samples(X_scaled)  # higher = more anomalous
        iso_score = (iso_raw - iso_raw.min()) / (iso_raw.max() - iso_raw.min() + 1e-8)

        # LOF: higher = more anomalous
        lof_raw = -self.lof.score_samples(X_scaled)
        lof_score = (lof_raw - lof_raw.min()) / (lof_raw.max() - lof_raw.min() + 1e-8)

        # Robust Z-score on amount_claimed
        if "amount_claimed" in features.columns:
            vals = features["amount_claimed"].values
            median = np.median(vals)
            mad = np.median(np.abs(vals - median))
            z_score = np.abs(vals - median) / (mad * 1.4826 + 1e-8)
            z_score = np.clip(z_score, 0, 10) / 10
        else:
            z_score = np.zeros(len(df))

        ensemble = 0.45 * iso_score + 0.35 * lof_score + 0.20 * z_score
        return np.clip(ensemble * 100, 0, 100)

    def _heuristic_score(self, df: pd.DataFrame) -> np.ndarray:
        """Fast heuristic when model is not trained yet."""
        scores = np.zeros(len(df))

        if "days_since_inception" in df.columns:
            scores += np.where(df["days_since_inception"] < 30, 25, 0)
        if "is_round_amount" in df.columns:
            scores += df["is_round_amount"].astype(int) * 15
        if "filed_on_weekend" in df.columns:
            scores += df["filed_on_weekend"].astype(int) * 10
        if "report_lag_days" in df.columns:
            scores += np.where(df["report_lag_days"] > 60, 20, 0)
        if "amount_claimed" in df.columns:
            q95 = np.percentile(df["amount_claimed"].dropna(), 95)
            scores += np.where(df["amount_claimed"] > q95, 20, 0)
        if "is_fraud_ring" in df.columns:
            scores += df["is_fraud_ring"].astype(int) * 30

        return np.clip(scores, 0, 100)
