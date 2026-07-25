import type { UrgencyLevel } from "@prisma/client";

/** Lower number = more severe. Used for queue sorting and for taking the
 * "floor" between a rule-engine result and an AI suggestion. */
export const URGENCY_SEVERITY: Record<UrgencyLevel, number> = {
  EMERGENCY: 0,
  URGENT: 1,
  MODERATE: 2,
  ROUTINE: 3,
};

/** Returns whichever of the two levels is more severe. `undefined` values
 * are treated as least severe, so a defined level always wins. */
export function moreSevereUrgency(
  a: UrgencyLevel | null | undefined,
  b: UrgencyLevel | null | undefined
): UrgencyLevel | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return URGENCY_SEVERITY[a] <= URGENCY_SEVERITY[b] ? a : b;
}
