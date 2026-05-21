/**
 * Theme utilities for reading CSS variables and converting colors
 * for use with libraries that don't support CSS variables directly (e.g., recharts)
 */

/**
 * Get the computed value of a CSS variable
 */
export function getCSSVariable(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Convert oklch color to rgb string for use in canvas/SVG
 */
export function oklchToRgb(oklch: string): string {
  if (typeof window === "undefined") return "#000000";
  
  const temp = document.createElement("div");
  temp.style.color = oklch;
  document.body.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  return computed || "#000000";
}

/**
 * Get chart colors from CSS variables (--chart-1 through --chart-5)
 * Returns array of rgb strings for use with recharts
 */
export function getChartColors(): string[] {
  const colors = [];
  for (let i = 1; i <= 5; i++) {
    const oklch = getCSSVariable(`--chart-${i}`);
    if (oklch) {
      colors.push(oklchToRgb(oklch));
    } else {
      // Fallback colors if CSS variables not found
      colors.push(`hsl(${40 + i * 20}, 70%, 50%)`);
    }
  }
  return colors;
}

/**
 * Get a single theme color by variable name
 */
export function getThemeColor(variableName: string): string {
  const oklch = getCSSVariable(variableName);
  return oklch ? oklchToRgb(oklch) : "#000000";
}

/**
 * Get tooltip style for recharts using theme colors
 */
export function getRechartsTooltipStyle() {
  return {
    backgroundColor: getCSSVariable("--card") || "#18181b",
    border: `1px solid ${getCSSVariable("--border") || "#27272a"}`,
    borderRadius: "8px",
    color: getCSSVariable("--foreground") || "#faf9f7",
  };
}

/**
 * Get axis tick color for recharts
 */
export function getAxisTickColor(): string {
  return getCSSVariable("--muted-foreground") || "#a1a1aa";
}
