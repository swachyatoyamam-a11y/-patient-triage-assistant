import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/shared/states";
import { cn } from "@/lib/utils";

const ACCENTS = {
  blue: { bg: "bg-clinical-blue/10", text: "text-clinical-blue" },
  emergency: { bg: "bg-triage-emergency/10", text: "text-triage-emergency" },
  urgent: { bg: "bg-triage-urgent/10", text: "text-triage-urgent" },
  moderate: { bg: "bg-triage-moderate/10", text: "text-triage-moderate" },
  routine: { bg: "bg-triage-routine/10", text: "text-triage-routine" },
} as const;

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = "blue",
  loading,
}: {
  label: string;
  value?: React.ReactNode;
  sublabel?: string;
  icon?: LucideIcon;
  accent?: keyof typeof ACCENTS;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  const a = ACCENTS[accent];
  return (
    <Card>
      <CardContent className="flex items-start justify-between pt-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase leading-snug tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 font-display text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", a.bg)}>
            <Icon size={18} className={a.text} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
