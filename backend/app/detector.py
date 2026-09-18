from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np

from .simulator import expected_snr_db, shannon_throughput_mbps

FEATURE_NAMES: List[str] = [
    "target_distance_m",
    "target_velocity_mps",
    "abs_velocity",
    "rcs_dbsm",
    "snr_db",
    "throughput_mbps",
    "log_ber",
    "signal_quality",
    "snr_residual",
    "tput_residual",
    "range_rate_inconsistency",
]


CLASS_PRIORITY = [
    ("SIGNAL_DROPOUT", lambda f, s: f["throughput_mbps"] < 6.0 or f["ber"] > 0.05),
    ("RF_JAMMING", lambda f, s: f["snr_db"] < 4.0 and f["ber"] > 5e-4),
    ("TARGET_GHOST", lambda f, s: abs(f.get("range_rate_inconsistency", 0.0)) > 6.5 or f.get("ghost_target") is not None),
    ("MULTIPATH_INTERFERENCE", lambda f, s: abs(s) > 6.0 and f["snr_db"] < 14.0),
]


def extract_features(frame: Dict[str, Any]) -> np.ndarray:
    distance = float(frame["target_distance_m"])
    velocity = float(frame["target_velocity_mps"])
    rcs = float(frame["rcs_dbsm"])
    snr = float(frame["snr_db"])
    tput = float(frame["throughput_mbps"])
    ber = max(float(frame["ber"]), 1e-12)
    quality = float(frame["signal_quality"])
    range_rate = float(frame.get("range_rate_mps", velocity))

    snr_hat = expected_snr_db(distance) + 0.18 * rcs
    tput_hat = shannon_throughput_mbps(snr)
    snr_residual = snr - snr_hat
    tput_residual = tput - tput_hat
    rr_inconsistency = velocity - range_rate

    vec = np.array(
        [
            distance,
            velocity,
            abs(velocity),
            rcs,
            snr,
            tput,
            math.log10(ber),
            quality,
            snr_residual,
            tput_residual,
            rr_inconsistency,
        ],
        dtype=np.float64,
    )
    return vec


def _sigmoid(x: float) -> float:
    x = max(-20.0, min(20.0, x))
    return 1.0 / (1.0 + math.exp(-x))


class AnomalyDetector:
    def __init__(self, artifact: Optional[Dict[str, Any]] = None) -> None:
        self.artifact = artifact or {}
        self.model = self.artifact.get("model")
        self.scaler = self.artifact.get("scaler")
        self.offset = float(self.artifact.get("score_offset", 0.42))
        self.scale = float(self.artifact.get("score_scale", 8.5))
        self.degraded_thr = float(self.artifact.get("degraded_threshold", 0.42))
        self.anomaly_thr = float(self.artifact.get("anomaly_threshold", 0.68))
        self.model_name = str(self.artifact.get("model_name", "IsolationForest-ISAC-v1"))

    @classmethod
    def load(cls, path: Path) -> "AnomalyDetector":
        artifact = joblib.load(path)
        return cls(artifact)

    @property
    def loaded(self) -> bool:
        return self.model is not None and self.scaler is not None

    def score_vector(self, vec: np.ndarray) -> float:
        if not self.loaded:
            return self._heuristic_score(vec)
        x = self.scaler.transform(vec.reshape(1, -1))
        raw = float(-self.model.score_samples(x)[0])
        return float(np.clip(_sigmoid((raw - self.offset) * self.scale), 0.0, 1.0))

    def _heuristic_score(self, vec: np.ndarray) -> float:
        # Fallback if model.pkl is missing: physics residual magnitude.
        snr = vec[4]
        tput = vec[5]
        log_ber = vec[6]
        snr_res = abs(vec[8])
        tput_res = abs(vec[9])
        rr = abs(vec[10])
        s = 0.0
        if snr < 8:
            s += 0.35
        if tput < 12:
            s += 0.25
        if log_ber > -3.5:
            s += 0.2
        s += min(0.25, snr_res / 20.0)
        s += min(0.2, tput_res / 80.0)
        s += min(0.15, rr / 20.0)
        return float(np.clip(s, 0.0, 1.0))

    def classify(self, frame: Dict[str, Any], features: np.ndarray) -> Optional[str]:
        injections = frame.get("active_injections") or []
        mapping = {
            "rf_jamming": "RF_JAMMING",
            "signal_dropout": "SIGNAL_DROPOUT",
            "target_ghosting": "TARGET_GHOST",
            "multipath": "MULTIPATH_INTERFERENCE",
        }
        for inj in injections:
            if inj in mapping:
                return mapping[inj]

        snr_residual = float(features[8])
        for label, pred in CLASS_PRIORITY:
            if pred(frame, snr_residual):
                return label
        if float(features[9]) < -25.0:
            return "LINK_DEGRADATION"
        return None

    def evaluate(self, frame: Dict[str, Any]) -> Tuple[float, str, Optional[str], float, bool]:
        features = extract_features(frame)
        # stash for classify ghost/range-rate
        frame = dict(frame)
        frame["range_rate_inconsistency"] = float(features[10])
        score = self.score_vector(features)
        classification = self.classify(frame, features)
        if frame.get("active_injections"):
            score = max(score, 0.76 if classification else 0.58)

        if score >= self.anomaly_thr:
            status = "ANOMALY"
        elif score >= self.degraded_thr:
            status = "DEGRADED"
        else:
            status = "NORMAL"
            if classification and score < self.degraded_thr * 0.85:
                classification = None

        if status == "ANOMALY" and classification is None:
            classification = "UNCORRELATED_RF_EVENT"

        confidence = float(np.clip(abs(score - 0.5) * 2.0, 0.15, 0.99))
        if status == "ANOMALY":
            confidence = float(np.clip(0.55 + score * 0.42, 0.55, 0.99))

        verified = bool(frame.get("active_injections")) and status != "NORMAL"
        if verified:
            confidence = float(np.clip(confidence + 0.08, 0.0, 0.99))

        return score, status, classification, confidence, verified
