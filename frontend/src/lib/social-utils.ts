export function formatMins(totalMinutes: number): string {
  if (totalMinutes >= 1000) {
    return (totalMinutes / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return Math.round(totalMinutes).toString();
}

export function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function angleFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `${h}deg`;
}
