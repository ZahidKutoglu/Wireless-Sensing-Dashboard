"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { TelemetryFrame } from "@/lib/types";

function fmt(n: number | undefined, digits = 1) {
  return n === undefined ? "—" : n.toFixed(digits);
}

function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1.5">
      <span className="font-mono text-[9px] tracking-[0.22em] text-white/70">{label}</span>
      <span className="font-mono text-[13px] text-signal">
        {value}
        {unit ? <span className="ml-1 text-[10px] text-white/40">{unit}</span> : null}
      </span>
    </div>
  );
}

export function TrackPanel({ latest, frames }: { latest: TelemetryFrame | null; frames: TelemetryFrame[] }) {
  const spark = frames.slice(-40).map((f) => ({
    seq: f.seq,
    snr: f.snr_db,
    range: f.target_distance_m,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-2 gap-x-4 px-3 pt-2">
        <Row label="RANGE" value={fmt(latest?.target_distance_m, 1)} unit="m" />
        <Row label="VELOCITY" value={fmt(latest?.target_velocity_mps, 2)} unit="m/s" />
        <Row label="AZIMUTH" value={fmt(latest?.target_azimuth_deg, 1)} unit="deg" />
        <Row label="ELEVATION" value={fmt(latest?.target_elevation_deg, 1)} unit="deg" />
        <Row label="EAST / X" value={fmt(latest?.target_x_m, 1)} unit="m" />
        <Row label="NORTH / Y" value={fmt(latest?.target_y_m, 1)} unit="m" />
        <Row label="RCS" value={fmt(latest?.rcs_dbsm, 2)} unit="dBsm" />
        <Row label="RANGE RATE" value={fmt(latest?.range_rate_mps, 2)} unit="m/s" />
      </div>

      {latest?.ghost_target ? (
        <div className="mx-3 mt-2 border border-warn/40 bg-warn/10 px-2 py-1.5 font-mono text-[10px] text-warn">
          FALSE TRACK · {latest.ghost_target.distance_m.toFixed(0)} m · AZ{" "}
          {latest.ghost_target.azimuth_deg.toFixed(0)}° · {latest.ghost_target.velocity_mps.toFixed(1)} m/s
        </div>
      ) : null}

      <div className="mt-2 min-h-[72px] flex-1 px-2 pb-2">
        <div className="mb-1 px-1 font-mono text-[9px] tracking-[0.22em] text-white/35">SNR  40s</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spark} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="snr" stroke="#22c55e" dot={false} strokeWidth={1.4} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
