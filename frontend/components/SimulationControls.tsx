"use client";

import { motion } from "framer-motion";
import type { InjectionType } from "@/lib/types";

const ACTIONS: {
  type: InjectionType;
  label: string;
  code: string;
  hint: string;
}[] = [
  { type: "rf_jamming", label: "RF JAMMING", code: "INJ-01", hint: "Broadband interferer" },
  { type: "signal_dropout", label: "SIGNAL DROPOUT", code: "INJ-02", hint: "Frame-drop / outage" },
  { type: "target_ghosting", label: "TARGET GHOST", code: "INJ-03", hint: "False scatterer" },
  { type: "multipath", label: "MULTIPATH", code: "INJ-04", hint: "Range walk / fade" },
];

export function SimulationControls({
  onInject,
  injecting,
  active,
}: {
  onInject: (type: InjectionType) => void;
  injecting: string | null;
  active: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
      {ACTIONS.map((a) => {
        const live = active.includes(a.type) || injecting === a.type;
        return (
          <motion.button
            key={a.type}
            whileTap={{ scale: 0.97 }}
            onClick={() => onInject(a.type)}
            className={`group relative overflow-hidden border px-3 py-2.5 text-left transition ${
              live
                ? "border-warn bg-warn/10 shadow-warn"
                : "border-white/10 bg-white/[0.02] hover:border-signal/50 hover:bg-signal/5"
            }`}
          >
            <span className="font-mono text-[9px] tracking-[0.28em] text-radar/80">{a.code}</span>
            <div className="font-display text-[13px] font-semibold tracking-[0.14em] text-white">
              {a.label}
            </div>
            <div className="font-mono text-[9px] text-white/60">{a.hint}</div>
            <span
              className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                live ? "bg-warn shadow-warn" : "bg-signal/40"
              }`}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
