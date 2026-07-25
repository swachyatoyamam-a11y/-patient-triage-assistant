import * as React from "react";
import { cn } from "@/lib/utils";
import { URGENCY_META, type UrgencyLevel } from "@/lib/utils";

/** Generic pill badge for tags/status text. */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-clinical-gray px-3 py-1 text-xs font-medium text-clinical-blueDark dark:bg-slate-800 dark:text-slate-200",
        className
      )}
      {...props}
    />
  );
}

/** Urgency-specific badge — the only place saturated triage color appears. */
export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  const meta = URGENCY_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        meta.bgClass,
        meta.colorClass
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
