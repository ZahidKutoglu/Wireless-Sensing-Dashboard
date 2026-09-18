import type { ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryFrame } from "@/lib/types";

type Row = {
  seq: number;
  snr: number;
  berLog: number;
  tput: number;
  rcs: number;
  q: number;
  anomalySnr?: number;
  anomalyTput?: number;
  anomalyRcs?: number;
};

function toRows(frames: TelemetryFrame[]): Row[] {
  return frames.map((f) => {
    const berLog = -Math.log10(Math.max(f.ber, 1e-12));
    const flag = f.status !== "NORMAL";
    return {
      seq: f.seq,
      snr: Number(f.snr_db.toFixed(2)),
      berLog: Number(berLog.toFixed(3)),
      tput: Number(f.throughput_mbps.toFixed(2)),
      rcs: Number(f.rcs_dbsm.toFixed(2)),
      q: Number(f.signal_quality.toFixed(2)),
      anomalySnr: flag ? Number(f.snr_db.toFixed(2)) : undefined,
      anomalyTput: flag ? Number(f.throughput_mbps.toFixed(2)) : undefined,
      anomalyRcs: flag ? Number(f.rcs_dbsm.toFixed(2)) : undefined,
    };
  });
}

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-radar/30 bg-black/90 px-2 py-1.5 font-mono text-[10px] text-white/80">
      <div className="mb-1 tracking-[0.2em] text-radar/80">FRAME {label}</div>
      {payload
        .filter((p) => p.value !== undefined && !String(p.name).startsWith("anomaly"))
        .map((p) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
          </div>
        ))}
    </div>
  );
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[140px] flex-1 flex-col">
      <div className="px-3 pt-1 font-mono text-[9px] tracking-[0.28em] text-white/45">{title}</div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function TelemetryCharts({ frames }: { frames: TelemetryFrame[] }) {
  const data = toRows(frames);
  const axis = {
    stroke: "#1e293b",
    tick: { fill: "#64748b", fontSize: 10, fontFamily: "IBM Plex Mono" },
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      <ChartFrame title="SNR  vs  −LOG10(BER)">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0f172a" strokeDasharray="3 8" />
            <XAxis dataKey="seq" hide />
            <YAxis yAxisId="l" {...axis} width={36} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={36} />
            <Tooltip content={<Tip />} />
            <Line
              yAxisId="l"
              type="monotone"
              dataKey="snr"
              name="SNR dB"
              stroke="#22c55e"
              dot={false}
              strokeWidth={1.6}
              isAnimationActive={false}
            />
            <Line
              yAxisId="r"
              type="monotone"
              dataKey="berLog"
              name="−log10 BER"
              stroke="#06b6d4"
              dot={false}
              strokeWidth={1.2}
              isAnimationActive={false}
            />
            <Scatter yAxisId="l" dataKey="anomalySnr" fill="#f59e0b" r={3.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="PACKET THROUGHPUT  MBPS">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0f172a" strokeDasharray="3 8" />
            <XAxis dataKey="seq" hide />
            <YAxis {...axis} width={36} />
            <Tooltip content={<Tip />} />
            <Line
              type="monotone"
              dataKey="tput"
              name="Mbps"
              stroke="#06b6d4"
              dot={false}
              strokeWidth={1.6}
              isAnimationActive={false}
            />
            <Scatter dataKey="anomalyTput" fill="#f59e0b" r={3.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="RCS dBsm  /  SIGNAL QUALITY">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#0f172a" strokeDasharray="3 8" />
            <XAxis dataKey="seq" {...axis} tick={false} height={10} />
            <YAxis yAxisId="l" {...axis} width={36} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={36} domain={[0, 100]} />
            <Tooltip content={<Tip />} />
            <Line
              yAxisId="l"
              type="monotone"
              dataKey="rcs"
              name="RCS dBsm"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={1.3}
              isAnimationActive={false}
            />
            <Line
              yAxisId="r"
              type="monotone"
              dataKey="q"
              name="Quality"
              stroke="#22c55e"
              dot={false}
              strokeWidth={1.3}
              isAnimationActive={false}
            />
            <Scatter yAxisId="l" dataKey="anomalyRcs" fill="#ef4444" r={3.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
