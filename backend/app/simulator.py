from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


INJECTION_LABELS = {
    "rf_jamming": "RF_JAMMING",
    "signal_dropout": "SIGNAL_DROPOUT",
    "target_ghosting": "TARGET_GHOST",
    "multipath": "MULTIPATH_INTERFERENCE",
}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def expected_snr_db(distance_m: float) -> float:
    """Radar-equation inspired SNR vs range (40 log R), referenced to 100 m."""
    r = max(distance_m, 8.0)
    return 36.0 - 32.0 * math.log10(r / 100.0)


def shannon_throughput_mbps(snr_db: float) -> float:
    snr_lin = 10.0 ** (snr_db / 10.0)
    return 9.6 * math.log2(1.0 + snr_lin)


def bpsk_ber(snr_db: float) -> float:
    snr_lin = 10.0 ** (_clamp(snr_db, -8.0, 40.0) / 10.0)
    # Approximate Q(sqrt(2*SNR)) with erfc; floor at 5e-8
    arg = math.sqrt(max(snr_lin, 1e-6))
    ber = 0.5 * math.erfc(arg / math.sqrt(2.0))
    return _clamp(ber, 5e-8, 0.5)


def signal_quality_index(snr_db: float, throughput_mbps: float, ber: float) -> float:
    snr_term = _clamp((snr_db + 5.0) / 40.0, 0.0, 1.0)
    tput_term = _clamp(throughput_mbps / 140.0, 0.0, 1.0)
    ber_term = _clamp(1.0 - math.log10(ber + 1e-12) / -2.5, 0.0, 1.0)
    return round(100.0 * (0.4 * snr_term + 0.35 * tput_term + 0.25 * (1.0 - ber_term)), 2)


@dataclass
class ActiveInjection:
    kind: str
    remaining: int
    intensity: float
    meta: Dict[str, float] = field(default_factory=dict)


class ISACSimulator:
    """
    Dynamic ISAC telemetry engine.

    Generates correlated sensing (range, velocity, RCS) and communications
    (SNR, throughput, BER) observables with physically motivated coupling,
    plus injectable RF/sensing anomalies.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        self.rng = random.Random(seed)
        self.seq = 0
        self.range_m = 142.0
        self.azimuth_deg = 38.0
        self.elevation_deg = 3.4
        self.radial_velocity = 4.2
        self.az_rate = 1.15
        self.mean_rcs = -4.2
        self.injections: List[ActiveInjection] = []
        self._ghost: Optional[Dict[str, float]] = None

    def reset(self, seed: Optional[int] = None) -> None:
        if seed is not None:
            self.rng.seed(seed)
        self.seq = 0
        self.range_m = 142.0
        self.azimuth_deg = 38.0
        self.elevation_deg = 3.4
        self.radial_velocity = 4.2
        self.az_rate = 1.15
        self.mean_rcs = -4.2
        self.injections = []
        self._ghost = None

    def inject(self, kind: str, duration_s: int = 12) -> None:
        if kind not in INJECTION_LABELS:
            raise ValueError(f"Unknown injection type: {kind}")
        intensity = {
            "rf_jamming": self.rng.uniform(14.0, 22.0),
            "signal_dropout": self.rng.uniform(0.7, 1.0),
            "target_ghosting": self.rng.uniform(0.8, 1.0),
            "multipath": self.rng.uniform(6.0, 10.0),
        }[kind]
        meta: Dict[str, float] = {}
        if kind == "target_ghosting":
            meta = {
                "ghost_range": _clamp(self.range_m * self.rng.uniform(1.6, 2.4), 80.0, 720.0),
                "ghost_az": (self.azimuth_deg + self.rng.uniform(25.0, 80.0)) % 360.0,
                "ghost_vel": self.rng.uniform(-28.0, 28.0),
                "ghost_rcs": self.rng.uniform(-18.0, 6.0),
            }
        self.injections.append(
            ActiveInjection(kind=kind, remaining=int(duration_s), intensity=intensity, meta=meta)
        )

    def _tick_injections(self) -> Tuple[Dict[str, ActiveInjection], List[str]]:
        alive: List[ActiveInjection] = []
        active_map: Dict[str, ActiveInjection] = {}
        for inj in self.injections:
            inj.remaining -= 1
            if inj.remaining >= 0:
                alive.append(inj)
                active_map[inj.kind] = inj
        self.injections = alive
        return active_map, list(active_map.keys())

    def _update_kinematics(self) -> None:
        # Slow, bounded target motion with mild heading wander.
        self.radial_velocity += self.rng.gauss(0.0, 0.35)
        self.radial_velocity = _clamp(self.radial_velocity, -24.0, 24.0)
        self.az_rate += self.rng.gauss(0.0, 0.08)
        self.az_rate = _clamp(self.az_rate, -2.8, 2.8)

        if self.range_m > 230.0:
            self.radial_velocity -= 1.1
        elif self.range_m < 100.0:
            self.radial_velocity += 1.1

        self.range_m += self.radial_velocity * 1.0
        if self.range_m < 55.0:
            self.range_m = 55.0
            self.radial_velocity = abs(self.radial_velocity) * 0.5 + 1.5
        if self.range_m > 320.0:
            self.range_m = 320.0
            self.radial_velocity = -abs(self.radial_velocity) * 0.5 - 1.5

        self.azimuth_deg = (self.azimuth_deg + self.az_rate) % 360.0
        self.elevation_deg = _clamp(self.elevation_deg + self.rng.gauss(0.0, 0.05), 0.4, 12.0)
        self.mean_rcs += self.rng.gauss(0.0, 0.04)
        self.mean_rcs = _clamp(self.mean_rcs, -12.0, 8.0)

    def generate_normal_vector(self) -> Dict[str, float]:
        """Independent normal-condition draw used for model training."""
        rng = self.rng
        distance = rng.uniform(70.0, 320.0)
        velocity = rng.gauss(6.0, 7.5)
        velocity = _clamp(velocity, -26.0, 26.0)
        rcs = rng.gauss(-3.5, 2.4)
        rcs = _clamp(rcs, -16.0, 10.0)
        snr = expected_snr_db(distance) + 0.18 * rcs + rng.gauss(0.0, 0.85)
        snr = _clamp(snr, 6.0, 38.0)
        throughput = shannon_throughput_mbps(snr) + rng.gauss(0.0, 2.4)
        throughput = _clamp(throughput, 8.0, 155.0)
        ber = bpsk_ber(snr) * rng.uniform(0.7, 1.6)
        ber = _clamp(ber, 5e-8, 0.05)
        quality = signal_quality_index(snr, throughput, ber)
        az = rng.uniform(0.0, 360.0)
        el = rng.uniform(0.5, 10.0)
        az_rad = math.radians(az)
        return {
            "target_distance_m": distance,
            "target_velocity_mps": velocity,
            "target_azimuth_deg": az,
            "target_elevation_deg": el,
            "target_x_m": distance * math.sin(az_rad),
            "target_y_m": distance * math.cos(az_rad),
            "rcs_dbsm": rcs,
            "snr_db": snr,
            "throughput_mbps": throughput,
            "ber": ber,
            "signal_quality": quality,
            "range_rate_mps": velocity + rng.gauss(0.0, 0.25),
        }

    def step(self) -> Dict:
        self.seq += 1
        self._update_kinematics()
        active, active_names = self._tick_injections()

        rcs = self.mean_rcs + self.rng.gauss(0.0, 1.15)
        snr = expected_snr_db(self.range_m) + 0.18 * rcs + self.rng.gauss(0.0, 0.7)
        range_m = self.range_m + self.rng.gauss(0.0, 0.45)
        velocity = self.radial_velocity + self.rng.gauss(0.0, 0.18)
        azimuth = self.azimuth_deg
        elevation = self.elevation_deg
        ghost = None
        self._ghost = None

        if "multipath" in active:
            inj = active["multipath"]
            phase = (self.seq * 0.42) % (2.0 * math.pi)
            snr -= inj.intensity * abs(math.sin(phase))
            range_m += 18.0 + 22.0 * math.sin(phase * 1.3)
            rcs += 4.5 * math.sin(phase * 2.1)
            velocity += self.rng.gauss(0.0, 3.2)

        if "rf_jamming" in active:
            inj = active["rf_jamming"]
            snr -= inj.intensity + self.rng.gauss(0.0, 1.4)
            rcs += self.rng.gauss(0.0, 6.5)
            velocity += self.rng.gauss(0.0, 4.5)

        dropout_zero = False
        if "signal_dropout" in active:
            inj = active["signal_dropout"]
            snr = -2.0 + self.rng.gauss(0.0, 2.2)
            if self.rng.random() < 0.55 + 0.35 * inj.intensity:
                dropout_zero = True

        if "target_ghosting" in active:
            inj = active["target_ghosting"]
            # Reported track jumps toward a false scatterer.
            leak = 0.35 * inj.intensity
            range_m = (1.0 - leak) * range_m + leak * inj.meta["ghost_range"]
            azimuth = (azimuth + leak * (inj.meta["ghost_az"] - azimuth)) % 360.0
            rcs = rcs * (1.0 - leak) + inj.meta["ghost_rcs"] * leak
            velocity = velocity * (1.0 - leak) + inj.meta["ghost_vel"] * leak + self.rng.gauss(0.0, 2.0)
            ghost = {
                "distance_m": round(inj.meta["ghost_range"] + self.rng.gauss(0.0, 4.0), 2),
                "azimuth_deg": round((inj.meta["ghost_az"] + self.rng.gauss(0.0, 1.5)) % 360.0, 2),
                "velocity_mps": round(inj.meta["ghost_vel"] + self.rng.gauss(0.0, 0.8), 2),
                "rcs_dbsm": round(inj.meta["ghost_rcs"] + self.rng.gauss(0.0, 0.9), 2),
            }
            self._ghost = ghost

        snr = _clamp(snr, -8.0, 40.0)
        rcs = _clamp(rcs, -28.0, 18.0)
        range_m = _clamp(range_m, 12.0, 800.0)
        velocity = _clamp(velocity, -40.0, 40.0)

        throughput = shannon_throughput_mbps(snr) + self.rng.gauss(0.0, 1.8)
        ber = bpsk_ber(snr) * self.rng.uniform(0.75, 1.45)

        if "rf_jamming" in active:
            throughput *= self.rng.uniform(0.08, 0.28)
            ber = _clamp(ber * self.rng.uniform(80.0, 400.0), 1e-3, 0.45)

        if dropout_zero:
            throughput = self.rng.uniform(0.0, 1.8)
            ber = self.rng.uniform(0.08, 0.42)

        throughput = _clamp(throughput, 0.0, 180.0)
        ber = _clamp(ber, 5e-8, 0.5)
        quality = signal_quality_index(snr, throughput, ber)

        az_rad = math.radians(azimuth)
        frame = {
            "seq": self.seq,
            "target_distance_m": round(range_m, 3),
            "target_velocity_mps": round(velocity, 3),
            "target_azimuth_deg": round(azimuth % 360.0, 3),
            "target_elevation_deg": round(elevation, 3),
            "target_x_m": round(range_m * math.sin(az_rad), 3),
            "target_y_m": round(range_m * math.cos(az_rad), 3),
            "rcs_dbsm": round(rcs, 3),
            "snr_db": round(snr, 3),
            "throughput_mbps": round(throughput, 3),
            "ber": float(f"{ber:.6e}"),
            "signal_quality": quality,
            "range_rate_mps": round(self.radial_velocity + self.rng.gauss(0.0, 0.12), 3),
            "active_injections": active_names,
            "ghost_target": ghost,
        }
        return frame
