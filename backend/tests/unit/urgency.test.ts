import { describe, it, expect } from "vitest";
import { moreSevereUrgency, URGENCY_SEVERITY } from "@/utils/urgency";

describe("moreSevereUrgency", () => {
  it("returns the more severe of two defined levels", () => {
    expect(moreSevereUrgency("URGENT", "EMERGENCY")).toBe("EMERGENCY");
    expect(moreSevereUrgency("EMERGENCY", "ROUTINE")).toBe("EMERGENCY");
    expect(moreSevereUrgency("MODERATE", "ROUTINE")).toBe("MODERATE");
  });

  it("is symmetric — argument order never changes the result", () => {
    expect(moreSevereUrgency("ROUTINE", "URGENT")).toBe(moreSevereUrgency("URGENT", "ROUTINE"));
  });

  it("treats a missing value as least severe, so a defined level always wins", () => {
    expect(moreSevereUrgency(null, "ROUTINE")).toBe("ROUTINE");
    expect(moreSevereUrgency("ROUTINE", null)).toBe("ROUTINE");
    expect(moreSevereUrgency(undefined, "EMERGENCY")).toBe("EMERGENCY");
  });

  it("returns null only when both sides are missing", () => {
    expect(moreSevereUrgency(null, null)).toBeNull();
    expect(moreSevereUrgency(undefined, undefined)).toBeNull();
  });

  it("severity ranking has EMERGENCY as strictly most severe", () => {
    const levels = Object.entries(URGENCY_SEVERITY);
    const emergencyRank = URGENCY_SEVERITY.EMERGENCY;
    for (const [level, rank] of levels) {
      if (level !== "EMERGENCY") expect(rank).toBeGreaterThan(emergencyRank);
    }
  });
});
