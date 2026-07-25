import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UrgencyBadge, Badge } from "@/components/ui/badge";

describe("UrgencyBadge", () => {
  it("renders the correct label for each level", () => {
    const { rerender } = render(<UrgencyBadge level="EMERGENCY" />);
    expect(screen.getByText("Emergency")).toBeInTheDocument();

    rerender(<UrgencyBadge level="ROUTINE" />);
    expect(screen.getByText("Routine")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders arbitrary children as a plain pill", () => {
    render(<Badge>awaiting review</Badge>);
    expect(screen.getByText("awaiting review")).toBeInTheDocument();
  });
});
