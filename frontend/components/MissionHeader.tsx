"use client";

import { ScoreBar } from "./HudMetric";
import type { StatusFlag, SystemStatus } from "@/lib/types";

export function MissionHeader({
  connected,
  status,
  lastStatus,
  lastScore,
  clock,
}: {
  connected: boolean;
  status: SystemStatus | null;
  lastStatus: StatusFlag;
  lastScore: number;
  clock: string;
}) {
  const statusColor =
    lastStatus === "ANOMALY"
      ? "text-warn"
      : lastStatus === "DEGRADED"
        ? "text-radar"
        : "text-signal";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-radar/20 bg-black px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="relative grid h-10 w-10 place-items-center border border-signal/40">
          <span className="absolute inset-1 border border-signal/20" />
          <span className="font-display text-lg font-bold text-signal">Φ</span>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold tracking-[0.22em] text-white">
              ISAC-01
            </h1>
            <span className="border border-warn/40 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.28em] text-warn">
              SENSING + COMMS
            </span>
          </div>
          <p className="font-mono text-[10px] tracking-[0.32em] text-white/65">
            INTEGRATED SENSING &amp; COMMUNICATIONS · ANOMALY DETECTOR
          </p>
        </div>
      </div>

      <ScoreBar score={lastScore} status={lastStatus} />

      <div className="flex items-center gap-5 font-mono text-[10px] tracking-[0.18em]">
        <div>
          <div className="text-white/45">LINK</div>
          <div className={connected ? "text-signal" : "text-kill"}>{connected ? "LOCKED" : "NO SYNC"}</div>
        </div>
        <div>
          <div className="text-white/45">TRACK</div>
          <div className={statusColor}>{lastStatus}</div>
        </div>
        <div>
          <div className="text-white/45">MODEL</div>
          <div className="text-radar">{status?.model_loaded ? "IF-300 LIVE" : "HEURISTIC"}</div>
        </div>
        <div className="text-right">
          <div className="text-white/45">UTC</div>
          <div className="text-signal">{clock}</div>
        </div>
      </div>
    </header>
  );
}
