import type { Severity } from "@/lib/mock-data";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-critical/15 text-critical border-critical/30",
    high: "bg-warning/15 text-warning border-warning/30",
    medium: "bg-accent/15 text-accent border-accent/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[severity]}`}
    >
      {severity}
    </span>
  );
}

export function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color =
    score >= 80
      ? "var(--color-success)"
      : score >= 60
        ? "var(--color-warning)"
        : "var(--color-critical)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-border)"
          strokeWidth={10}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-4xl font-semibold">{score}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
      </div>
    </div>
  );
}
