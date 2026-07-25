import { describe, it, expect } from "vitest";
import { cn, URGENCY_META } from "@/lib/utils";

describe("cn", () => {
  it("merges class lists and resolves Tailwind conflicts (later wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });
});

describe("URGENCY_META", () => {
  it("defines all four urgency levels with distinct colors", () => {
    const levels = ["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"] as const;
    const colorClasses = levels.map((l) => URGENCY_META[l].colorClass);
    expect(new Set(colorClasses).size).toBe(4);
  });

  it("EMERGENCY reads as the most alarming label", () => {
    expect(URGENCY_META.EMERGENCY.label).toBe("Emergency");
    expect(URGENCY_META.EMERGENCY.colorClass).toContain("emergency");
  });
});
