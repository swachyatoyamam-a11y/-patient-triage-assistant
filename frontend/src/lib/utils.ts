import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class lists safely (later classes win on conflicts).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps an urgency level to its triage color token + human label.
 * Central place so color meaning never drifts across the app.
 */
export type UrgencyLevel = "EMERGENCY" | "URGENT" | "MODERATE" | "ROUTINE";

export const URGENCY_META: Record<
  UrgencyLevel,
  { label: string; colorClass: string; bgClass: string; dotClass: string }
> = {
  EMERGENCY: {
    label: "Emergency",
    colorClass: "text-triage-emergency",
    bgClass: "bg-triage-emergency/10",
    dotClass: "bg-triage-emergency",
  },
  URGENT: {
    label: "Urgent",
    colorClass: "text-triage-urgent",
    bgClass: "bg-triage-urgent/10",
    dotClass: "bg-triage-urgent",
  },
  MODERATE: {
    label: "Moderate",
    colorClass: "text-triage-moderate",
    bgClass: "bg-triage-moderate/10",
    dotClass: "bg-triage-moderate",
  },
  ROUTINE: {
    label: "Routine",
    colorClass: "text-triage-routine",
    bgClass: "bg-triage-routine/10",
    dotClass: "bg-triage-routine",
  },
};
