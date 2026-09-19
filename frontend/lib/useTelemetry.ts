"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  API_BASE,
  getWsUrl,
  type Incident,
  type InjectionType,
  type SystemStatus,
  type TelemetryFrame,
} from "./types";

const MAX_FRAMES = 120;

function mergeFrames(prev: TelemetryFrame[], incoming: TelemetryFrame[]) {
  const map = new Map<number, TelemetryFrame>();
  for (const frame of prev) map.set(frame.seq, frame);
  for (const frame of incoming) map.set(frame.seq, frame);
  return Array.from(map.values())
    .sort((a, b) => a.seq - b.seq)
    .slice(-MAX_FRAMES);
}

export function useTelemetry() {
  const [frames, setFrames] = useState<TelemetryFrame[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [injecting, setInjecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSeen = useRef(0);

  const ingest = useCallback((batch: TelemetryFrame | TelemetryFrame[]) => {
    const list = Array.isArray(batch) ? batch : [batch];
    const valid = list.filter((f) => f && typeof f.seq === "number");
    if (!valid.length) return;
    lastSeen.current = Date.now();
    setConnected(true);
    setFrames((prev) => mergeFrames(prev, valid));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let beatTimer: ReturnType<typeof setInterval> | undefined;

    async function pull() {
      try {
        const [histRes, ledgerRes, sysRes] = await Promise.all([
          fetch(`${API_BASE}/api/isac/telemetry?limit=90`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/isac/incidents?limit=40`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/isac/status`, { cache: "no-store" }),
        ]);
        if (!histRes.ok) throw new Error(`telemetry ${histRes.status}`);
        const hist = await histRes.json();
        const ledger = await ledgerRes.json();
        const sys = await sysRes.json();
        if (cancelled) return;
        if (Array.isArray(hist?.frames)) ingest(hist.frames);
        if (Array.isArray(ledger)) setIncidents(ledger);
        setStatus(sys);
        setError(null);
        if (Array.isArray(hist?.frames) && hist.frames.length > 0) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setConnected(false);
          setLoading(false);
          setError(err instanceof Error ? err.message : "backend unreachable");
        }
      }
    }

    function connect() {
      const wsUrl = getWsUrl();
      if (cancelled || !wsUrl) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        return;
      }
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as TelemetryFrame;
          if (typeof payload.seq === "number") ingest(payload);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!cancelled) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      };
    }

    pull();
    connect();
    pollTimer = setInterval(pull, 1000);
    beatTimer = setInterval(() => {
      if (Date.now() - lastSeen.current > 3500) setConnected(false);
    }, 1000);

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      if (pollTimer) clearInterval(pollTimer);
      if (beatTimer) clearInterval(beatTimer);
      const socket = wsRef.current;
      wsRef.current = null;
      socket?.close();
    };
  }, [ingest]);

  const inject = useCallback(async (type: InjectionType, duration_s = 12) => {
    setInjecting(type);
    try {
      const res = await fetch(`${API_BASE}/api/isac/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, duration_s }),
      });
      if (!res.ok) throw new Error(`inject ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "inject failed");
    } finally {
      setTimeout(() => setInjecting(null), 400);
    }
  }, []);

  const latest = frames[frames.length - 1] ?? null;
  return {
    frames,
    incidents,
    status,
    connected,
    latest,
    inject,
    injecting,
    error,
    loading: loading && !latest,
  };
}
