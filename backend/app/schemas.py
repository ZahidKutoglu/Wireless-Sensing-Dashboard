from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

StatusFlag = Literal["NORMAL", "DEGRADED", "ANOMALY"]
InjectionType = Literal["rf_jamming", "signal_dropout", "target_ghosting", "multipath"]


class GhostTarget(BaseModel):
    distance_m: float
    azimuth_deg: float
    velocity_mps: float
    rcs_dbsm: float


class TelemetryFrame(BaseModel):
    timestamp: str
    seq: int
    target_distance_m: float
    target_velocity_mps: float
    target_azimuth_deg: float
    target_elevation_deg: float
    target_x_m: float
    target_y_m: float
    rcs_dbsm: float
    snr_db: float
    throughput_mbps: float
    ber: float
    signal_quality: float
    range_rate_mps: float
    anomaly_score: float = Field(ge=0.0, le=1.0)
    status: StatusFlag
    classification: Optional[str] = None
    verified: bool = False
    active_injections: List[str] = Field(default_factory=list)
    ghost_target: Optional[GhostTarget] = None
    model_confidence: float = Field(ge=0.0, le=1.0, default=0.0)


class Incident(BaseModel):
    id: str
    timestamp: str
    seq: int
    classification: str
    anomaly_score: float
    status: StatusFlag
    confidence: float
    verified: bool
    summary: str
    metrics_snapshot: dict


class InjectRequest(BaseModel):
    type: InjectionType
    duration_s: int = Field(default=12, ge=4, le=40)


class InjectResponse(BaseModel):
    accepted: bool
    type: str
    duration_s: int
    message: str


class SystemStatus(BaseModel):
    service: str
    model_loaded: bool
    model_name: str
    frames_emitted: int
    uptime_s: float
    ws_clients: int
    last_status: StatusFlag
    last_score: float
    active_injections: List[str]


class TelemetryHistory(BaseModel):
    frames: List[TelemetryFrame]
    count: int
