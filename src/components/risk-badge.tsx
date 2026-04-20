import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/mock-data";

const RISK_STYLES: Record<
  RiskLevel,
  { label: string; dot: string; bg: string; text: string; ring: string }
> = {
  low: {
    label: "Bajo",
    dot: "bg-risk-low",
    bg: "bg-risk-low/10",
    text: "text-risk-low",
    ring: "ring-risk-low/30",
  },
  medium: {
    label: "Medio",
    dot: "bg-risk-medium",
    bg: "bg-risk-medium/10",
    text: "text-risk-medium",
    ring: "ring-risk-medium/30",
  },
  high: {
    label: "Alto",
    dot: "bg-risk-high animate-pulse",
    bg: "bg-risk-high/10",
    text: "text-risk-high",
    ring: "ring-risk-high/30",
  },
};

export function RiskBadge({
  risk,
  size = "sm",
  className,
}: {
  risk: RiskLevel;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = RISK_STYLES[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        s.bg,
        s.text,
        s.ring,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      Riesgo {s.label}
    </span>
  );
}
