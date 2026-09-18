export type StatusFlag = "NORMAL" | "DEGRADED" | "ANOMALY";

export type InjectionType =
  | "rf_jamming"
  | "signal_dropout"
  | "target_ghosting"
  | "multipath";

export interface GhostTarget {
  distance_m: number;
  azimuth_deg: number;
  velocity_mps: number;
  rcs_dbsm: number;
}

export interface TelemetryFrame {
  timestamp: string;
  seq: number;
  target_distance_m: number;
  target_velocity_mps: number;
  target_azimuth_deg: number;
  target_elevation_deg: number;
  target_x_m: number;
  target_y_m: number;
  rcs_dbsm: number;
  snr_db: number;
  throughput_mbps: number;
  ber: number;
  signal_quality: number;
  range_rate_mps: number;
  anomaly_score: number;
  status: StatusFlag;
  classification: string | null;
  verified: boolean;
  active_injections: string[];
  ghost_target: GhostTarget | null;
  model_confidence: number;
}

export interface Incident {
  id: string;
  timestamp: string;
  seq: number;
  classification: string;
  anomaly_score: number;
  status: StatusFlag;
  confidence: number;
  verified: boolean;
  summary: string;
  metrics_snapshot: Record<string, number>;
}

export interface SystemStatus {
  service: string;
  model_loaded: boolean;
  model_name: string;
  frames_emitted: number;
  uptime_s: number;
  ws_clients: number;
  last_status: StatusFlag;
  last_score: number;
  active_injections: string[];
}

export const API_BASE = "";

export function getWsUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (configured) return configured;
  return null;
}
