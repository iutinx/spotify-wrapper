"use client";

import { useEffect, useMemo, useRef } from "react";

// Realistic, non-interactive music waveform — a scrolling readout of mirrored
// amplitude bars driven by a musical envelope (dynamics) + spectral detail +
// periodic beat transients, so it reads like real audio playing back.
// Ported from the design bundle's wave.js (default "mirror" style).

const ACCENT = "#0a0a0a";

export type WaveformRole = "bg" | "hero" | "card";

interface RoleCfg {
  baseCount: number;
  amp: number;
  heightFrac: number;
  speed: number;
  opacity: number;
  freq: number;
  vbW: number;
  vbH: number;
  wrapClass: string;
}

const ROLE: Record<WaveformRole, RoleCfg> = {
  bg:   { baseCount: 150, amp: 0.95, heightFrac: 0.74, speed: 0.40, opacity: 0.10, freq: 0.30, vbW: 1920, vbH: 600, wrapClass: "wave-bg-wrap" },
  hero: { baseCount: 120, amp: 1.00, heightFrac: 0.80, speed: 0.70, opacity: 0.90, freq: 0.34, vbW: 1920, vbH: 260, wrapClass: "wave-wrap" },
  card: { baseCount: 84,  amp: 1.00, heightFrac: 0.80, speed: 0.70, opacity: 0.95, freq: 0.40, vbW: 1920, vbH: 260, wrapClass: "wave-wrap" },
};

// Continuous in `phase` so the waveform scrolls seamlessly. Combines a slow
// musical envelope, mid + fast spectral content, and periodic beat transients.
function amplitudeAt(phase: number, seed: number) {
  const env =
    0.5 +
    0.34 * Math.sin(phase * 0.20 + seed) +
    0.16 * Math.sin(phase * 0.071 + seed * 1.7);
  const mid = 0.5 + 0.5 * Math.sin(phase * 1.25 + seed * 0.6);
  const fast = 0.5 + 0.5 * Math.sin(phase * 3.05 + seed * 1.3);
  const beat = Math.pow(0.5 + 0.5 * Math.sin(phase * 0.42 + seed), 10) * 0.75;
  const a = Math.max(0, env) * (0.34 + 0.42 * mid + 0.24 * fast) * 0.68 + beat;
  return Math.min(1.3, a);
}

export function Waveform({ role }: { role: WaveformRole }) {
  const cfg = ROLE[role];
  const rectRefs = useRef<(SVGRectElement | null)[]>([]);

  const { bars, count, seed } = useMemo(() => {
    const count = Math.max(10, Math.round(cfg.baseCount));
    const gap = cfg.vbW / count;
    const barW = Math.max(1.5, gap * 0.46);
    const bars = Array.from({ length: count }, (_, i) => ({
      x: gap * i + (gap - barW) / 2,
      w: barW,
      rx: barW / 2,
    }));
    return { bars, count, seed: Math.random() * 100 };
  }, [cfg]);

  useEffect(() => {
    let rafId = 0;
    const cy = cfg.vbH / 2;
    const maxH = cfg.vbH * cfg.heightFrac;
    const frame = (ts: number) => {
      const t = ts / 1000;
      const scroll = t * cfg.speed * 6;
      for (let i = 0; i < count; i++) {
        const el = rectRefs.current[i];
        if (!el) continue;
        const a = amplitudeAt(i * cfg.freq + scroll, seed);
        const h = Math.max(2, a * maxH * cfg.amp);
        el.setAttribute("y", (cy - h / 2).toFixed(2));
        el.setAttribute("height", h.toFixed(2));
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [cfg, count, seed]);

  return (
    <div className={cfg.wrapClass} aria-hidden="true">
      <svg
        className="wave-svg"
        viewBox={`0 0 ${cfg.vbW} ${cfg.vbH}`}
        preserveAspectRatio="none"
      >
        {bars.map((b, i) => (
          <rect
            key={i}
            ref={(el) => { rectRefs.current[i] = el; }}
            x={b.x.toFixed(2)}
            width={b.w.toFixed(2)}
            rx={b.rx.toFixed(2)}
            fill={ACCENT}
            opacity={cfg.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
