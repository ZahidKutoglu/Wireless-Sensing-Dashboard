#!/usr/bin/env python3
"""Train IsolationForest on baseline ISAC telemetry and export model.pkl."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.detector import FEATURE_NAMES, extract_features  # noqa: E402
from app.simulator import ISACSimulator  # noqa: E402


def build_training_matrix(n_samples: int = 18000, seed: int = 42) -> np.ndarray:
    sim = ISACSimulator(seed=seed)
    rows = []
    for _ in range(n_samples):
        frame = sim.generate_normal_vector()
        rows.append(extract_features(frame))
    return np.vstack(rows)


def main() -> None:
    print("Generating baseline ISAC telemetry for IsolationForest training...")
    X = build_training_matrix()
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=300,
        contamination=0.012,
        max_samples=512,
        random_state=42,
        n_jobs=-1,
    )
    print("Fitting IsolationForest (n_estimators=300)...")
    model.fit(Xs)

    raw = -model.score_samples(Xs)
    p50 = float(np.percentile(raw, 50))
    p95 = float(np.percentile(raw, 95))
    p99 = float(np.percentile(raw, 99))
    offset = p95
    spread = max(p99 - p95, 1e-3)
    scale = 2.2 / spread

    artifact = {
        "model": model,
        "scaler": scaler,
        "feature_names": FEATURE_NAMES,
        "score_offset": offset,
        "score_scale": scale,
        "degraded_threshold": 0.42,
        "anomaly_threshold": 0.68,
        "model_name": "IsolationForest-ISAC-v1",
        "calibration": {
            "raw_p50": p50,
            "raw_p95": p95,
            "raw_p99": p99,
            "n_samples": int(X.shape[0]),
        },
    }

    out_dir = ROOT / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "model.pkl"
    joblib.dump(artifact, out_path)

    meta_path = out_dir / "model_meta.json"
    meta_path.write_text(
        json.dumps(
            {
                "model_name": artifact["model_name"],
                "features": FEATURE_NAMES,
                "score_offset": offset,
                "score_scale": scale,
                "degraded_threshold": 0.42,
                "anomaly_threshold": 0.68,
                "calibration": artifact["calibration"],
            },
            indent=2,
        )
    )
    print(f"Wrote {out_path}")
    print(f"Wrote {meta_path}")
    print(f"Calibration raw scores p50={p50:.4f} p95={p95:.4f} p99={p99:.4f}")


if __name__ == "__main__":
    main()
