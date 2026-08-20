import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const apiFetchMock = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import AdminDashboardPage from "@/app/admin/dashboard/page";

// See health-timeline.test.tsx — the dashboard's charts measure their
// container with getBoundingClientRect instead of ResponsiveContainer,
// which never fires ResizeObserver in jsdom.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ width: 400, height: 220, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
});

const EXTENDED_SUMMARY = {
  newPatientsThisWeek: 3,
  newPatientsThisMonth: 9,
  activePatientCount: 12,
  patientsRequiringReview: 4,
  aiEscalationRate: 33.333,
  clinicianOverrideCount: 2,
  aiErrorCount: 1,
  averageProcessingMinutes: 5.4,
  commonConditions: [{ condition: "Diabetes", count: 6 }],
  abnormalVitalsCount: 3,
  highRiskPatientCount: 2,
  assessmentVolumeOverTime: [
    { date: "2026-08-10", count: 2 },
    { date: "2026-08-11", count: 5 },
  ],
};

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/analytics/summary") {
        return Promise.resolve({ patientsToday: 1, emergencyCases: 0, urgencyBreakdown: [], averageWaitMinutes: null });
      }
      if (path === "/analytics/common-symptoms") return Promise.resolve({ symptoms: [] });
      if (path === "/assessments?limit=500") return Promise.resolve({ assessments: [] });
      if (path === "/analytics/extended-summary") return Promise.resolve(EXTENDED_SUMMARY);
      return Promise.reject(new Error("unexpected call: " + path));
    });
  });

  it("renders the extended system/AI/patient stat cards from the new analytics endpoint", async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText("Patients & system health")).toBeInTheDocument();

    const newPatientsCard = screen.getByText("New patients (7d)").closest('[class*="rounded-card"]') as HTMLElement;
    expect(within(newPatientsCard).getByText("3")).toBeInTheDocument();

    const highRiskCard = screen.getByText("High-risk patients").closest('[class*="rounded-card"]') as HTMLElement;
    expect(within(highRiskCard).getByText("2")).toBeInTheDocument();

    const escalationCard = screen.getByText("AI escalation rate").closest('[class*="rounded-card"]') as HTMLElement;
    expect(within(escalationCard).getByText("33%")).toBeInTheDocument();

    expect(screen.getByText("Clinician overrides")).toBeInTheDocument();
  });

  it("shows the common-conditions chart card once extended data with conditions loads", async () => {
    render(<AdminDashboardPage />);
    expect(await screen.findByText("Common conditions on file")).toBeInTheDocument();
    expect(screen.getByText("Assessment volume (14 days)")).toBeInTheDocument();
  });

  it("shows an abnormal-vitals notice when the count is nonzero", async () => {
    render(<AdminDashboardPage />);
    expect(await screen.findByText(/recorded vitals reading/)).toBeInTheDocument();
  });

  it("does not blow up when the extended summary has zero conditions/volume (empty states instead)", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/analytics/summary") {
        return Promise.resolve({ patientsToday: 0, emergencyCases: 0, urgencyBreakdown: [], averageWaitMinutes: null });
      }
      if (path === "/analytics/common-symptoms") return Promise.resolve({ symptoms: [] });
      if (path === "/assessments?limit=500") return Promise.resolve({ assessments: [] });
      if (path === "/analytics/extended-summary") {
        return Promise.resolve({ ...EXTENDED_SUMMARY, commonConditions: [], assessmentVolumeOverTime: [], abnormalVitalsCount: 0 });
      }
      return Promise.reject(new Error("unexpected call: " + path));
    });

    render(<AdminDashboardPage />);
    expect(await screen.findByText("No conditions on file")).toBeInTheDocument();
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
    expect(screen.queryByText(/recorded vitals reading/)).not.toBeInTheDocument();
  });
});
