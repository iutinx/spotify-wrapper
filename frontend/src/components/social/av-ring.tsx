export function AvRing({ prog, a, image }: { prog: number; a: string; image?: string | null }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c * (1 - prog / 100);
  return (
    <span className="db-av-ring">
      <svg viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--db-hair)" strokeWidth="2.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--db-spotify)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span
        className={`db-favatar${image ? "" : " gen"}`}
        style={
          image
            ? { backgroundImage: `url(${image})` }
            : ({ "--a": a } as React.CSSProperties)
        }
      />
    </span>
  );
}
