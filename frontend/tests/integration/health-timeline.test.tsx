import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthTimeline } from "@/components/health/health-timeline";
import type { HealthMetricRecord } from "@/types/api";

// The chart components measure their container with getBoundingClientRect
// (see health-timeline.tsx's useElementWidth) instead of ResponsiveContainer,
// which never fires ResizeObserver in jsdom. Give it a non-zero width so the
// chart branch actually renders in tests.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ width: 400, height: 180, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
});

function metric(overrides: Partial<HealthMetricRecord>): HealthMetricRecord {
  return {
    id: Math.random().toString(36).slice(2),
    patientId: "p1",
    connectionId: "c1",
    source: "DEMO",
    metricType: "HEART_RATE",
    value: 72,
    unit: "bpm",
    recordedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    metadata: { synthetic: true },
    ...overrides,
  };
}

describe("HealthTimeline", () => {
  it("shows a loading skeleton while metrics are still loading", () => {
    render(<HealthTimeline metrics={null} loading />);
    expect(screen.queryByText(/no readings yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recent readings/i)).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no readings", () => {
    render(<HealthTimeline metrics={[]} loading={false} />);
    expect(screen.getByText(/no readings yet/i)).toBeInTheDocument();
  });

  it("renders a trend chart for a metric type with 2+ points, and falls back to the table for a single-point type", () => {
    const now = Date.now();
    const metrics: HealthMetricRecord[] = [
      metric({ metricType: "HEART_RATE", value: 70, recordedAt: new Date(now - 2 * 3600_000).toISOString() }),
      metric({ metricType: "HEART_RATE", value: 74, recordedAt: new Date(now - 1 * 3600_000).toISOString() }),
      // WEIGHT_KG has only one reading — should never get its own chart.
      metric({ metricType: "WEIGHT_KG", value: 71.4, unit: "kg", recordedAt: new Date(now).toISOString() }),
    ];

    render(<HealthTimeline metrics={metrics} loading={false} />);

    expect(screen.getByText("Heart rate (24h)")).toBeInTheDocument();
    // No chart card is titled "Weight" — it only ever appears as a table row.
    expect(screen.queryByRole("heading", { name: "Weight" })).not.toBeInTheDocument();

    // The table always lists every reading, chart-eligible or not.
    expect(screen.getByText("Recent readings")).toBeInTheDocument();
    const table = screen.getByText("Recent readings").closest('[class*="rounded-card"]') as HTMLElement;
    expect(table.textContent).toContain("Weight");
    expect(table.textContent).toContain("Heart rate");
  });

  it("does not render any chart when every metric type has fewer than 2 points", () => {
    const metrics: HealthMetricRecord[] = [
      metric({ metricType: "HEART_RATE", value: 70 }),
      metric({ metricType: "SPO2", value: 97, unit: "%" }),
    ];

    render(<HealthTimeline metrics={metrics} loading={false} />);

    expect(screen.queryByText("Heart rate (24h)")).not.toBeInTheDocument();
    expect(screen.queryByText("SpO2 trend")).not.toBeInTheDocument();
    expect(screen.getByText("Recent readings")).toBeInTheDocument();
  });
});
