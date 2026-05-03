import { cn } from "@/lib/utils";

type SparklineTone = "ok" | "info" | "warn" | "alert";

interface ISparklineProps {
  values: number[];
  tone?: SparklineTone;
  className?: string;
}

const TONE_TO_STROKE: Record<SparklineTone, string> = {
  ok: "#1A6B46",
  info: "#155579",
  warn: "#8A5A07",
  alert: "#8A4209",
};

/** SVG viewBox dimensions for the sparkline */
const SVG_WIDTH = 100;
const SVG_HEIGHT = 30;
/** Maximum chart height in SVG units, leaving a 2-unit top margin */
const CHART_AMPLITUDE = 28;

export function Sparkline({ values, tone = "info", className }: ISparklineProps) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const px = (index / Math.max(values.length - 1, 1)) * SVG_WIDTH;
      const py = SVG_HEIGHT - (value / max) * CHART_AMPLITUDE;
      return `${px},${py}`;
    })
    .join(" ");
  const stroke = TONE_TO_STROKE[tone];
  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-full", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
