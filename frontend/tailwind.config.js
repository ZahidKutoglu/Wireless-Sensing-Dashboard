/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        hull: "#050505",
        signal: "#22c55e",
        radar: "#06b6d4",
        warn: "#f59e0b",
        kill: "#ef4444",
      },
      fontFamily: {
        display: ["var(--font-display)", "Rajdhani", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        signal: "0 0 24px rgba(34, 197, 94, 0.25)",
        radar: "0 0 28px rgba(6, 182, 212, 0.22)",
        warn: "0 0 24px rgba(245, 158, 11, 0.28)",
      },
      backgroundImage: {
        mesh: "linear-gradient(rgba(6,182,212,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.045) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
