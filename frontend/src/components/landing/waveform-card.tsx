"use client";

import { Waveform, type WaveformRole } from "./waveform";

export function WaveformCard({ role = "hero" }: { role?: WaveformRole }) {
  return <Waveform role={role} />;
}
