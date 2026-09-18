import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Rajdhani } from "next/font/google";
import "./globals.css";

const display = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ISAC-01 · Sensing Anomaly Detector",
  description:
    "Integrated Sensing & Communications wireless telemetry dashboard with IsolationForest anomaly detection.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} bg-black antialiased`}>
        {children}
      </body>
    </html>
  );
}
