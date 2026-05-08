import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

interface IRelativeTimeProps {
  /**
   * ISO-8601 timestamp string. Anything `new Date()` accepts works, but ISO is
   * the canonical input — that's also what flows back into the `dateTime`
   * attribute for native `<time>` semantics.
   */
  iso: string | null | undefined;
  /**
   * Override "now" for tests / SSR. Defaults to `Date.now()` at render time.
   */
  now?: number;
  /**
   * Locale tag for the absolute timestamp shown on hover (e.g. "en-US").
   * Defaults to the user's browser locale.
   */
  locale?: string;
  className?: string;
}

interface IRelativeBucket {
  key: string;
  values: Record<string, number>;
}

function bucketize(deltaMs: number): IRelativeBucket {
  if (deltaMs < MS_PER_SECOND) {
    return { key: "justNow", values: {} };
  }
  const seconds = Math.floor(deltaMs / MS_PER_SECOND);
  if (seconds < SECONDS_PER_MINUTE) {
    return { key: "seconds", values: { count: seconds } };
  }
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) {
    return { key: "minutes", values: { count: minutes } };
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return { key: "hours", values: { count: hours } };
  }
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < DAYS_PER_WEEK) {
    return { key: "days", values: { count: days } };
  }
  const weeks = Math.floor(days / DAYS_PER_WEEK);
  return { key: "weeks", values: { count: weeks } };
}

/**
 * Renders a `<time>` element showing a short relative phrase ("5m ago") with
 * the absolute, human-readable timestamp on hover via the `title` attribute.
 *
 * Why: list / detail screens often show a relative timestamp because that's
 * what reviewers actually care about ("how stale is this?"). The absolute on
 * hover lets users confirm the precise moment without doing arithmetic.
 */
export function RelativeTime({
  iso,
  now,
  locale,
  className,
}: IRelativeTimeProps): React.JSX.Element {
  const { t } = useTranslation();
  // useState lazy init keeps render pure — Date.now() is read once at mount
  // when no `now` prop is supplied. Callers that need ticking display can
  // remount the component or pass a controlled `now`.
  const [defaultNow] = useState<number>(() => Date.now());

  if (iso === null || iso === undefined || iso === "") {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const reference = now ?? defaultNow;
  const deltaMs = reference - target.getTime();

  let label: string;
  if (deltaMs < 0) {
    label = t("relativeTime.justNow");
  } else {
    const bucket = bucketize(deltaMs);
    label = t(`relativeTime.${bucket.key}`, bucket.values);
  }

  // Human-readable absolute (e.g. "May 6, 2026, 3:14:22 PM"). We deliberately
  // include seconds because reviewers sometimes need to correlate with logs.
  const absolute = target.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <time dateTime={iso} title={absolute} className={cn("tabular-nums", className)}>
      {label}
    </time>
  );
}
