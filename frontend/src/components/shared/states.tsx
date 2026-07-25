import { AlertTriangle, Inbox } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-clinical-border/60 dark:bg-slate-800 ${className}`} />;
}

export function TableRowsSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-clinical-border last:border-0 dark:border-slate-800">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <Skeleton className="h-4 w-full max-w-[10rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-clinical-border bg-white p-4 dark:bg-slate-900 dark:border-slate-800">
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-clinical-border bg-white/50 px-6 py-14 text-center dark:bg-slate-900/50 dark:border-slate-700">
      <Inbox className="mb-3 text-slate-300 dark:text-slate-600" size={32} />
      <p className="font-display font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-triage-emergency/20 bg-triage-emergency/5 px-6 py-14 text-center">
      <AlertTriangle className="mb-3 text-triage-emergency" size={32} />
      <p className="font-display font-semibold text-slate-800 dark:text-slate-100">Something went wrong</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full border border-clinical-border px-4 py-2 text-sm font-medium text-clinical-blueDark hover:bg-clinical-gray dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}
