"use client";

import type { StatusFlag } from "@/lib/types";

export function HudMetric({
  label,
  value,
  unit,
  sub,
  alert,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  alert?: StatusFlag | "idle";
}) {
  const color =
    alert === "ANOMALY"
      ? "text-warn"
      : alert === "DEGRADED"
        ? "text-radar"
        : "text-signal";
  return (
    <div className="border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <div className="font-mono text-[9px] tracking-[0.28em] text-white/55">{label}</div>
      <div className={`mt-0.5 flex items-baseline gap-1 font-mono ${color}`}>
        <span className="text-[22px] leading-none tracking-tight drop-shadow-[0_0_8px_rgba(34,197,94,0.35)]">{value}</span>
        {unit ? <span className="text-[10px] text-white/55">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1 font-mono text-[9px] text-white/45">{sub}</div> : null}
    </div>
  );
}

export function ScoreBar({ score, status }: { score: number; status: StatusFlag }) {
  const pct = Math.round(score * 100);
  const fill =
    status === "ANOMALY" ? "bg-warn" : status === "DEGRADED" ? "bg-radar" : "bg-signal";
  return (
    <div className="min-w-[180px]">
      <div className="mb-1 flex justify-between font-mono text-[9px] tracking-[0.22em] text-white/45">
        <span>ANOMALY SCORE</span>
        <span className={status === "ANOMALY" ? "text-warn" : "text-signal"}>{score.toFixed(3)}</span>
      </div>
      <div className="h-[6px] overflow-hidden border border-white/10 bg-white/5">
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
