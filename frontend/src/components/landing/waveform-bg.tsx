"use client";

import { useEffect, useMemo, useRef } from "react";

const VB_W = 1920;
const VB_H = 600;
const CENTER_Y = VB_H / 2;
const LINE_COUNT = 9;
const ACCENT = "#0a0a0a";
const SAMPLES = 200;
const LINE_AMP = 5.5;
const SPREAD = VB_H * 0.55;

interface LineConfig {
  tNorm: number;
  seedA: number;
  seedB: number;
  seedC: number;
  fA: number;
  fB: number;
  fC: number;
}

export function WaveformBg() {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  const lines = useMemo<LineConfig[]>(() => {
    const arr: LineConfig[] = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      arr.push({
        tNorm: LINE_COUNT === 1 ? 0.5 : i / (LINE_COUNT - 1),
        seedA: i * 0.73 + 1.1,
        seedB: i * 1.91 - 0.4,
        seedC: i * 2.37 + 3.7,
        fA: 0.012 + (i % 3) * 0.003,
        fB: 0.028 + ((i + 1) % 4) * 0.004,
        fC: 0.055 + ((i + 2) % 5) * 0.005,
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    let rafId = 0;
    const frame = (ts: number) => {
      const t = ts / 1000;
      for (let idx = 0; idx < lines.length; idx++) {
        const ln = lines[idx];
        const el = pathRefs.current[idx];
        if (!el) continue;

        const restY = CENTER_Y + (ln.tNorm - 0.5) * SPREAD;
        let d = "";
        for (let i = 0; i <= SAMPLES; i++) {
          const x = (i / SAMPLES) * VB_W;
          const env = 0.55 + 0.45 * Math.sin(x * 0.0035 + t * 0.4 + ln.seedB);
          const lowBody = Math.sin(x * ln.fA + t * 1.1 + ln.seedA) * LINE_AMP;
          const midDetail = Math.sin(x * ln.fB + t * 1.8 + ln.seedB) * LINE_AMP * 0.55;
          const highMicro =
            Math.sin(x * (ln.fC * 2.2) + t * 3.2 + ln.seedC) * LINE_AMP * 0.28 +
            Math.sin(x * (ln.fC * 4.7) + t * 4.6 + ln.seedA * 1.3) * LINE_AMP * 0.14;
          const y = restY + (lowBody + midDetail + highMicro) * env;
          d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(2) + " ";
        }
        el.setAttribute("d", d);
        const edge = Math.abs(ln.tNorm - 0.5) * 2;
        el.setAttribute("opacity", (0.05 + (1 - edge) * 0.07).toFixed(2));
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [lines]);

  return (
    <div className="wave-bg-wrap" aria-hidden="true">
      <svg className="wave-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
        {lines.map((_, i) => (
          <path
            key={i}
            ref={(el) => { pathRefs.current[i] = el; }}
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
