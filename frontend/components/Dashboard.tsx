"use client";

import { useEffect, useState } from "react";
import { AnomalyFeed } from "@/components/AnomalyFeed";
import { HudMetric } from "@/components/HudMetric";
import { MissionHeader } from "@/components/MissionHeader";
import { Panel } from "@/components/Panel";
import { SimulationControls } from "@/components/SimulationControls";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { TrackPanel } from "@/components/TrackPanel";
import { useTelemetry } from "@/lib/useTelemetry";

function fmtBer(ber: number) {
  if (!Number.isFinite(ber)) return "—";
  return ber.toExponential(2);
}

export function Dashboard() {
  const { frames, incidents, status, connected, latest, inject, injecting, error } = useTelemetry();
  const [clock, setClock] = useState("--:--:--.---");

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toISOString().slice(11, 23));
    }, 80);
    return () => clearInterval(id);
  }, []);

  const flag = latest?.status ?? "NORMAL";
  const active = latest?.active_injections ?? status?.active_injections ?? [];

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-void text-white">
      <div className="pointer-events-none absolute inset-0 bg-mesh bg-[size:48px_48px] opacity-50" />

      <MissionHeader
        connected={connected}
        status={status}
        lastStatus={flag}
        lastScore={latest?.anomaly_score ?? status?.last_score ?? 0}
        clock={clock}
      />

      {error ? (
        <div className="relative z-10 border-b border-kill/40 bg-kill/10 px-4 py-1 font-mono text-[11px] text-kill">
          LINK ERROR · {error} · waiting for API on :8010
        </div>
      ) : null}

      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-12 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 p-2">
        <div className="col-span-12 grid grid-cols-2 gap-2 md:grid-cols-6">
          <HudMetric
            label="RANGE"
            value={latest ? latest.target_distance_m.toFixed(1) : "—"}
            unit="m"
            sub={latest ? `AZ ${latest.target_azimuth_deg.toFixed(1)}°` : "NO TRACK"}
            alert={flag}
          />
          <HudMetric
            label="VELOCITY"
            value={latest ? latest.target_velocity_mps.toFixed(2) : "—"}
            unit="m/s"
            sub={latest ? `Ṙ ${latest.range_rate_mps.toFixed(2)} m/s` : ""}
            alert={flag}
          />
          <HudMetric
            label="RCS"
            value={latest ? latest.rcs_dbsm.toFixed(2) : "—"}
            unit="dBsm"
            sub={latest ? `EL ${latest.target_elevation_deg.toFixed(1)}°` : ""}
            alert={flag}
          />
          <HudMetric
            label="SNR"
            value={latest ? latest.snr_db.toFixed(2) : "—"}
            unit="dB"
            sub={latest ? `Q ${latest.signal_quality.toFixed(0)}` : ""}
            alert={flag}
          />
          <HudMetric
            label="THROUGHPUT"
            value={latest ? latest.throughput_mbps.toFixed(1) : "—"}
            unit="Mbps"
            sub={`SEQ ${latest?.seq ?? 0}`}
            alert={flag}
          />
          <HudMetric
            label="BER"
            value={latest ? fmtBer(latest.ber) : "—"}
            sub={latest?.classification?.replaceAll("_", " ") ?? "NOMINAL"}
            alert={flag}
          />
        </div>

        <Panel
          title="TELEMETRY TIME SERIES"
          tag="1 Hz"
          className="col-span-12 min-h-0 lg:col-span-8"
          accent="cyan"
        >
          <TelemetryCharts frames={frames} />
        </Panel>

        <div className="col-span-12 flex min-h-0 flex-col gap-2 lg:col-span-4">
          <Panel
            title="SENSING TRACK"
            tag={latest ? `TGT-01` : "STANDBY"}
            className="min-h-[180px] flex-[3]"
            accent="green"
          >
            <TrackPanel latest={latest} frames={frames} />
          </Panel>
          <Panel
            title="INCIDENT LEDGER"
            tag={`${incidents.length}`}
            className="min-h-[180px] flex-[4]"
            accent={flag === "ANOMALY" ? "amber" : "cyan"}
          >
            <AnomalyFeed incidents={incidents} />
          </Panel>
        </div>

        <Panel
          title="FAULT INJECTION"
          tag="ARM"
          className="col-span-12 lg:col-span-8"
          accent="amber"
        >
          <SimulationControls onInject={inject} injecting={injecting} active={active} />
        </Panel>

        <Panel title="LINK" tag={status?.service ?? "ISAC"} className="col-span-12 lg:col-span-4">
          <div className="grid h-full grid-cols-4 gap-px bg-white/5 font-mono text-[10px]">
            <div className="bg-black p-3">
              <div className="tracking-[0.18em] text-white/50">UPTIME</div>
              <div className="mt-1 text-lg text-signal">{status ? `${Math.floor(status.uptime_s)}s` : "—"}</div>
            </div>
            <div className="bg-black p-3">
              <div className="tracking-[0.18em] text-white/50">FRAMES</div>
              <div className="mt-1 text-lg text-signal">{status?.frames_emitted ?? latest?.seq ?? 0}</div>
            </div>
            <div className="bg-black p-3">
              <div className="tracking-[0.18em] text-white/50">WS</div>
              <div className="mt-1 text-lg text-radar">{status?.ws_clients ?? 0}</div>
            </div>
            <div className="bg-black p-3">
              <div className="tracking-[0.18em] text-white/50">CONF</div>
              <div className="mt-1 text-lg text-warn">
                {latest ? `${(latest.model_confidence * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
          </div>
        </Panel>
      </main>
    </div>
  );
}
