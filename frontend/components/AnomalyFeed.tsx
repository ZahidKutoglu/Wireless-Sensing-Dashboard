"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Incident } from "@/lib/types";

function tone(status: Incident["status"]) {
  if (status === "ANOMALY") return "text-warn border-warn/40";
  if (status === "DEGRADED") return "text-radar border-radar/40";
  return "text-signal border-signal/40";
}

export function AnomalyFeed({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="h-full overflow-y-auto px-2 py-2">
      {incidents.length === 0 ? (
        <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.25em] text-white/30">
          LEDGER EMPTY · NOMINAL TRACK
        </div>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {incidents.map((inc) => (
              <motion.li
                key={`${inc.id}-${inc.seq}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`border-l-2 bg-white/[0.03] px-2 py-1.5 ${tone(inc.status)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[11px] font-semibold tracking-[0.16em]">
                    {inc.classification.replaceAll("_", " ")}
                  </span>
                  <span className="font-mono text-[9px] text-white/45">
                    {new Date(inc.timestamp).toISOString().slice(11, 23)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-white/55">
                  <span>SCORE {inc.anomaly_score.toFixed(2)}</span>
                  <span>CONF {(inc.confidence * 100).toFixed(0)}%</span>
                  <span className={inc.verified ? "text-signal" : "text-warn"}>
                    {inc.verified ? "VERIFIED" : "UNVERIFIED"}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[9px] text-white/35">{inc.summary}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
