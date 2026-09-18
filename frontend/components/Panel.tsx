"use client";

import type { ReactNode } from "react";

type Accent = "cyan" | "green" | "amber" | "red";

const accentMap: Record<Accent, string> = {
  cyan: "border-radar/70 text-radar",
  green: "border-signal/70 text-signal",
  amber: "border-warn/70 text-warn",
  red: "border-kill/70 text-kill",
};

export function Panel({
  title,
  tag,
  children,
  className = "",
  accent = "cyan",
  right,
}: {
  title: string;
  tag?: string;
  children: ReactNode;
  className?: string;
  accent?: Accent;
  right?: ReactNode;
}) {
  const tone = accentMap[accent];
  return (
    <section
      className={`relative flex min-h-0 flex-col overflow-hidden bg-black/80 ${className}`}
    >
      <span className={`pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t ${tone}`} />
      <span className={`pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t ${tone}`} />
      <span className={`pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l ${tone}`} />
      <span className={`pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r ${tone}`} />
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-1.5">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[11px] font-semibold tracking-[0.28em] text-white">
            {title}
          </h2>
          {tag ? (
            <span className={`font-mono text-[9px] tracking-[0.22em] ${tone.split(" ")[1]}`}>
              {tag}
            </span>
          ) : null}
        </div>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
