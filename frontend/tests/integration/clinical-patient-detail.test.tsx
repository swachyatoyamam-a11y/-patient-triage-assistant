import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "assessment-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

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

const toastMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/components/shared/toast", () => ({
  useToast: () => toastMock,
}));

import AssessmentReviewPage from "@/app/clinical/patients/[id]/page";

// Chart components (reused HealthTimeline) measure via getBoundingClientRect
// instead of ResponsiveContainer — see health-timeline.test.tsx.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ width: 400, height: 180, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
});

const ASSESSMENT = {
  id: "assessment-1",
  patientId: "patient-1",
  status: "AWAITING_REVIEW",
  urgencyLevel: "MODERATE",
  intake: { primarySymptom: "headache", age: 40, sex: "Female" },
  clinicianNotes: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  reviewedAt: null,
  symptoms: [],
  ruleTriggers: [],
  vitals: null,
  patient: { id: "patient-1", user: { firstName: "Jane", lastName: "Doe" } },
  healthSnapshot: null,
};

const PATIENT_DETAIL = {
  patient: {
    id: "patient-1",
    dateOfBirth: "1986-01-01",
    sex: "Female",
    bloodType: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    user: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: null },
    medicalConditions: [{ id: "c1", name: "Diabetes", status: "ACTIVE", diagnosedAt: null, notes: null, createdAt: "", updatedAt: "" }],
    allergies: [{ id: "a1", substance: "Penicillin", reaction: null, severity: "moderate", createdAt: "" }],
    medications: [{ id: "m1", name: "Metformin", dosage: "500mg", frequency: null, isActive: true, startedAt: null, createdAt: "" }],
    surgeries: [],
    healthConnections: [{ id: "hc1", provider: "DEMO", status: "CONNECTED", lastSyncedAt: null, connectedAt: "", disconnectedAt: null }],
  },
  assessments: [],
  recentMetrics: [],
  auditLogs: [
    { id: "log1", action: "MEDICAL_PROFILE_UPDATED", metadata: null, createdAt: "2026-08-01T00:00:00.000Z", user: { email: "jane@example.com", role: "PATIENT" } },
  ],
};

function mockApi() {
  apiFetchMock.mockImplementation((path: string, opts?: { method?: string; body?: string }) => {
    if (path === "/assessments/assessment-1") return Promise.resolve({ assessment: ASSESSMENT });
    if (path === "/analytics/patients/patient-1") return Promise.resolve(PATIENT_DETAIL);
    if (path === "/assessments/assessment-1" && opts?.method === "PATCH") return Promise.resolve({ assessment: ASSESSMENT });
    return Promise.reject(new Error("unexpected call: " + path));
  });
}

describe("AssessmentReviewPage — extended patient sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it("renders medical history, allergies, medications, and connected health sources from the patient-detail endpoint", async () => {
    render(<AssessmentReviewPage />);

    expect(await screen.findByText("Medical history")).toBeInTheDocument();
    expect(screen.getByText("Diabetes")).toBeInTheDocument();
    expect(screen.getByText(/Penicillin/)).toBeInTheDocument();
    expect(screen.getByText(/Metformin/)).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("renders the audit history from the patient-detail endpoint", async () => {
    render(<AssessmentReviewPage />);
    expect(await screen.findByText("Audit history")).toBeInTheDocument();
    expect(screen.getByText("medical profile updated")).toBeInTheDocument();
  });

  it("lets a clinician override urgency, calling PATCH with the new level", async () => {
    render(<AssessmentReviewPage />);
    await screen.findByText("Medical history");

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "URGENT");
    const applyBtn = screen.getByRole("button", { name: /apply override/i });
    expect(applyBtn).not.toBeDisabled();

    await userEvent.click(applyBtn);

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/assessments/assessment-1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ urgencyLevel: "URGENT" }) })
      )
    );
  });

  it("keeps the core assessment view usable when the patient-detail call fails", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/assessments/assessment-1") return Promise.resolve({ assessment: ASSESSMENT });
      if (path === "/analytics/patients/patient-1") return Promise.reject(new Error("boom"));
      return Promise.reject(new Error("unexpected call: " + path));
    });

    render(<AssessmentReviewPage />);
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("headache")).toBeInTheDocument();
  });
});
