export function Dial({ pct, size = 84, label }: { pct: number; size?: number; label?: string }) {
  const small = size <= 52;
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  const numFs = small ? 40 : 34;
  const sw = small ? 8 : 7;
  return (
    <span className="db-dial">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--db-hair)" strokeWidth={sw} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--db-spotify)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y={label ? 46 : 50}
          textAnchor="middle"
          dominantBaseline="central"
          className="db-dial-num"
          fontSize={numFs}
        >
          {pct}
          {!small && (
            <tspan className="db-dial-pc" fontSize="16">
              %
            </tspan>
          )}
        </text>
        {label && (
          <text x="50" y="70" textAnchor="middle" className="db-dial-lbl" fontSize="8">
            {label}
          </text>
        )}
      </svg>
    </span>
  );
}
