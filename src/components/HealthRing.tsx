export function HealthRing({
  value,
  size = 180,
  label = "Score Santé",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circ;
  const color =
    pct >= 75
      ? "var(--color-success)"
      : pct >= 50
        ? "var(--color-warning)"
        : "var(--color-destructive)";
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-muted)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-extrabold tabular-nums">{Math.round(pct)}</div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
