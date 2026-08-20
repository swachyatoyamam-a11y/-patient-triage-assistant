import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import MedicalHistoryPage from "@/app/(patient)/profile/medical-history/page";

const emptyProfile = {
  patient: { dateOfBirth: "1990-01-01", sex: "Female", bloodType: null, emergencyContactName: null, emergencyContactPhone: null },
  conditions: [],
  allergies: [],
  medications: [],
  surgeries: [],
};

describe("MedicalHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and shows the patient's stored conditions", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...emptyProfile,
      conditions: [{ id: "c1", name: "Diabetes", status: "ACTIVE", diagnosedAt: null, notes: null, createdAt: "", updatedAt: "" }],
    });

    render(<MedicalHistoryPage />);

    // The common-condition chip for Diabetes should render as selected,
    // and it should also appear in the "your conditions" list below.
    expect(await screen.findByRole("button", { name: "Diabetes" })).toHaveClass("bg-clinical-blue");
    expect(screen.getByLabelText("Remove Diabetes")).toBeInTheDocument();
  });

  it("adds a condition by clicking a common-condition chip", async () => {
    apiFetchMock.mockResolvedValueOnce(emptyProfile); // initial load
    apiFetchMock.mockResolvedValueOnce({ condition: { id: "c2" } }); // POST
    apiFetchMock.mockResolvedValueOnce({
      ...emptyProfile,
      conditions: [{ id: "c2", name: "Hypertension", status: "ACTIVE", diagnosedAt: null, notes: null, createdAt: "", updatedAt: "" }],
    }); // reload

    render(<MedicalHistoryPage />);
    await screen.findByRole("button", { name: "Hypertension" });

    await userEvent.click(screen.getByRole("button", { name: "Hypertension" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/patients/me/conditions",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Hypertension" }) })
      )
    );
  });

  it("adds a custom condition via the free-text form", async () => {
    apiFetchMock.mockResolvedValueOnce(emptyProfile);
    apiFetchMock.mockResolvedValueOnce({ condition: { id: "c3" } });
    apiFetchMock.mockResolvedValueOnce(emptyProfile);

    render(<MedicalHistoryPage />);
    const input = await screen.findByPlaceholderText("Other / custom condition");
    await userEvent.type(input, "Migraine");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/patients/me/conditions",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Migraine" }) })
      )
    );
  });

  it("removes a condition and shows an error toast if the request fails", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ...emptyProfile,
      conditions: [{ id: "c1", name: "Asthma", status: "ACTIVE", diagnosedAt: null, notes: null, createdAt: "", updatedAt: "" }],
    });
    apiFetchMock.mockRejectedValueOnce(new Error("network down"));

    render(<MedicalHistoryPage />);
    const removeButton = await screen.findByLabelText("Remove Asthma");
    await userEvent.click(removeButton);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });

  it("saves emergency info", async () => {
    apiFetchMock.mockResolvedValueOnce(emptyProfile);
    apiFetchMock.mockResolvedValueOnce({ patient: {} });
    apiFetchMock.mockResolvedValueOnce(emptyProfile);

    render(<MedicalHistoryPage />);
    const bloodTypeInput = await screen.findByPlaceholderText("e.g. O+");
    await userEvent.type(bloodTypeInput, "O+");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/patients/me/emergency-info",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    expect(toastMock.success).toHaveBeenCalled();
  });
});
