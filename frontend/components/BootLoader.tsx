"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const STEPS = [
  "HANDSHAKE / API GATEWAY",
  "LOAD ISOLATIONFOREST ARTIFACT",
  "PULL TELEMETRY BUFFER",
  "LOCK SENSING TRACK",
];

export function BootLoader() {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const ticks = setInterval(() => setElapsed((s) => s + 1), 1000);
    const walk = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 900);
    return () => {
      clearInterval(ticks);
      clearInterval(walk);
    };
  }, []);

  const pct = Math.min(96, 18 + step * 22 + (elapsed % 3) * 2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/92"
    >
      <div className="pointer-events-none absolute inset-0 bg-mesh bg-[size:40px_40px] opacity-40" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-[min(520px,92vw)] border border-radar/30 bg-black px-6 py-7"
      >
        <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-signal" />
        <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-signal" />
        <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-signal" />
        <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-signal" />

        <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-white/45">
          <span>ISAC-01</span>
          <span className="text-radar">ACQUIRING LINK</span>
          <span>T+{elapsed.toString().padStart(2, "0")}s</span>
        </div>

        <div className="mt-5 flex items-center gap-5">
          <div className="relative grid h-16 w-16 place-items-center">
            <motion.span
              className="absolute inset-0 rounded-full border border-signal/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
            <motion.span
              className="absolute inset-1 rounded-full border-t border-signal"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
            <span className="font-display text-lg font-bold text-signal">Φ</span>
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-[0.22em] text-white">
              SYSTEM BOOT
            </div>
            <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-signal">
              {STEPS[step]}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-1 flex justify-between font-mono text-[9px] tracking-[0.2em] text-white/40">
            <span>UPLINK</span>
            <span className="text-signal">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden border border-white/10 bg-white/5">
            <motion.div
              className="h-full bg-signal shadow-signal"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>
        </div>

        <ul className="mt-5 space-y-1.5 font-mono text-[10px] tracking-[0.16em]">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? "text-signal" : i < step ? "text-white/50" : "text-white/25"}>
              <span className="mr-2">{i === step ? "▸" : i < step ? "■" : "□"}</span>
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-5 font-mono text-[9px] tracking-[0.2em] text-white/30">
          WAITING ON SERVERLESS TELEMETRY · FIRST FRAME
        </p>
      </motion.div>
    </motion.div>
  );
}
