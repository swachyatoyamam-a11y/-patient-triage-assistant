import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

import { SymptomChecker } from "@/components/triage/symptom-checker";

async function advanceToTemperatureStep() {
  const next = () => screen.getByRole("button", { name: /next/i });
  await userEvent.type(screen.getByPlaceholderText("e.g. 34"), "30");
  await userEvent.click(next());
  await userEvent.click(await screen.findByRole("button", { name: "Male" }));
  await userEvent.click(next());
  await userEvent.type(await screen.findByPlaceholderText(/chest pain, sore throat/i), "sore throat");
  await userEvent.click(next());
  await userEvent.click(await screen.findByRole("button", { name: "3" }));
  await userEvent.click(next());
  await userEvent.type(await screen.findByPlaceholderText("e.g. 6"), "12");
  await userEvent.click(next());
  expect(await screen.findByText(/temperature/i)).toBeInTheDocument();
}

describe("SymptomChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The component fetches the stored medical profile on mount to prefill
    // age/sex — reject it by default so these tests (which exercise manual
    // entry) aren't affected; mockResolvedValueOnce calls below for
    // "/assessments" still take priority over this base implementation.
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/patients/me/medical-profile") return Promise.reject(new Error("not mocked in this test"));
      return Promise.resolve(undefined);
    });
  });

  it("shows the first question (age) and disables Next until it's valid", async () => {
    render(<SymptomChecker />);
    expect(screen.getByText("What is your age?")).toBeInTheDocument();

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    const input = screen.getByPlaceholderText("e.g. 34");
    await userEvent.type(input, "45");
    expect(nextButton).not.toBeDisabled();
  });

  it("advances to the sex question after a valid age", async () => {
    render(<SymptomChecker />);
    await userEvent.type(screen.getByPlaceholderText("e.g. 34"), "45");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText("What is your sex?")).toBeInTheDocument();
  });

  it("only shows the pregnancy question when sex is Female", async () => {
    render(<SymptomChecker />);
    await userEvent.type(screen.getByPlaceholderText("e.g. 34"), "30");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Male" }));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    // Next question after sex=Male should be the primary symptom, NOT
    // the pregnancy question — this is the `skip` logic in STEPS being
    // exercised, not just rendered.
    expect(await screen.findByText(/main symptom/i)).toBeInTheDocument();
  });

  it("requires a temperature before Next enables, and defaults to Celsius", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    const tempInput = screen.getByPlaceholderText("e.g. 37.0");
    await userEvent.type(tempInput, "37.5");
    expect(nextButton).not.toBeDisabled();
  });

  it("shows an inline error and blocks Next for an out-of-range Celsius temperature", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();

    await userEvent.type(screen.getByPlaceholderText("e.g. 37.0"), "50");
    expect(await screen.findByText(/between 30°C and 45°C/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("converts the entered temperature when the unit is switched", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();

    await userEvent.type(screen.getByPlaceholderText("e.g. 37.0"), "37");
    await userEvent.click(screen.getByRole("button", { name: "°F" }));
    expect(await screen.findByDisplayValue("98.6")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "°C" }));
    expect(await screen.findByDisplayValue("37")).toBeInTheDocument();
  });

  it("shows the correct out-of-range message in Fahrenheit and blocks Next", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();

    await userEvent.click(screen.getByRole("button", { name: "°F" }));
    await userEvent.type(screen.getByPlaceholderText("e.g. 98.6"), "80");
    expect(await screen.findByText(/between 86°F and 113°F/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("only allows numeric input with up to one decimal place for temperature", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();

    const tempInput = screen.getByPlaceholderText("e.g. 37.0") as HTMLInputElement;
    await userEvent.type(tempInput, "3a7.5.6abc");
    expect(tempInput).toHaveValue("37.5");
  });

  it("treats pulse rate, SpO2, and blood pressure as optional but validates when entered", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();
    const next = () => screen.getByRole("button", { name: /next/i });

    await userEvent.type(screen.getByPlaceholderText("e.g. 37.0"), "37");
    await userEvent.click(next());

    // Pulse rate — leaving it blank is valid (optional field).
    expect(await screen.findByText(/pulse rate/i)).toBeInTheDocument();
    expect(next()).not.toBeDisabled();

    await userEvent.type(await screen.findByPlaceholderText("e.g. 78"), "10");
    expect(await screen.findByText(/between 20 and 250 bpm/i)).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it("rejects systolic <= diastolic blood pressure with an inline error", async () => {
    render(<SymptomChecker />);
    await advanceToTemperatureStep();
    const next = () => screen.getByRole("button", { name: /next/i });

    await userEvent.type(screen.getByPlaceholderText("e.g. 37.0"), "37");
    await userEvent.click(next()); // temperature -> pulse rate
    await userEvent.click(next()); // pulse rate (blank, optional) -> SpO2
    await userEvent.click(next()); // SpO2 (blank, optional) -> systolic

    await userEvent.type(await screen.findByPlaceholderText("e.g. 120"), "80");
    await userEvent.click(next()); // systolic -> diastolic

    await userEvent.type(await screen.findByPlaceholderText("e.g. 80"), "90");
    expect(await screen.findByText(/systolic pressure must be greater than diastolic/i)).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it("drives through every step and submits, showing the result panel on success", async () => {
    // Path-aware rather than mockResolvedValueOnce: the component's mount-time
    // profile prefetch is also a call to apiFetch, and would otherwise
    // consume a queued "Once" value meant for the later /assessments POST.
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/assessments") {
        return Promise.resolve({
          assessment: {
            id: "a1",
            urgencyLevel: "ROUTINE",
            recommendation: { explanation: "Symptoms appear mild." },
          },
          notice: "This is not a medical diagnosis. Please consult a qualified healthcare professional.",
        });
      }
      return Promise.reject(new Error("not mocked in this test"));
    });

    render(<SymptomChecker />);
    const next = () => screen.getByRole("button", { name: /next/i });

    await userEvent.type(screen.getByPlaceholderText("e.g. 34"), "30");
    await userEvent.click(next());

    // sex=Male skips the pregnancy step later
    await userEvent.click(await screen.findByRole("button", { name: "Male" }));
    await userEvent.click(next());

    await userEvent.type(
      await screen.findByPlaceholderText(/chest pain, sore throat/i),
      "sore throat"
    );
    await userEvent.click(next());

    await userEvent.click(await screen.findByRole("button", { name: "3" })); // pain level
    await userEvent.click(next());

    await userEvent.type(await screen.findByPlaceholderText("e.g. 6"), "12"); // duration hours
    await userEvent.click(next());

    await userEvent.type(await screen.findByPlaceholderText("e.g. 37.0"), "37.2"); // temperature — mandatory
    await userEvent.click(next());

    await userEvent.type(await screen.findByPlaceholderText("e.g. 78"), "82"); // pulse rate
    await userEvent.click(next());

    await userEvent.type(await screen.findByPlaceholderText("e.g. 98"), "97"); // SpO2
    await userEvent.click(next());

    await userEvent.type(await screen.findByPlaceholderText("e.g. 120"), "118"); // systolic
    await userEvent.click(next());

    await userEvent.type(await screen.findByPlaceholderText("e.g. 80"), "76"); // diastolic
    await userEvent.click(next());

    await userEvent.click(next()); // additional symptoms — optional, skip
    await userEvent.click(next()); // medical history — optional, skip
    await userEvent.click(next()); // medications — optional, skip

    // sex=Male means the pregnancy step does not appear here — straight
    // to lifestyle factors (the `skip` logic actually being exercised).
    expect(await screen.findByText(/lifestyle/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/assessments", expect.anything()));
    const [path, options] = apiFetchMock.mock.calls.find((call) => call[0] === "/assessments")!;
    expect(path).toBe("/assessments");
    const body = JSON.parse((options as { body: string }).body);
    expect(body.age).toBe(30);
    expect(body.sex).toBe("Male");
    expect(body.primarySymptom).toBe("sore throat");
    expect(body.painLevel).toBe(3);
    expect(body.durationHours).toBe(12);
    expect(body.temperatureCelsius).toBe(37.2);
    expect(body.heartRate).toBe(82);
    expect(body.oxygenSaturation).toBe(97);
    expect(body.bloodPressureSystolic).toBe(118);
    expect(body.bloodPressureDiastolic).toBe(76);
    expect(body.isPregnant).toBeUndefined();

    expect(await screen.findByText("Your assessment has been submitted")).toBeInTheDocument();
    expect(screen.getByText("Symptoms appear mild.")).toBeInTheDocument();
  });

  it("prefills age and sex from the stored medical profile without blocking manual entry", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/patients/me/medical-profile") {
        return Promise.resolve({
          patient: { dateOfBirth: "1990-01-15", sex: "Female", bloodType: null, emergencyContactName: null, emergencyContactPhone: null },
          conditions: [],
          allergies: [],
          medications: [],
          surgeries: [],
        });
      }
      return Promise.reject(new Error("not mocked in this test"));
    });

    render(<SymptomChecker />);

    const ageInput = (await screen.findByPlaceholderText("e.g. 34")) as HTMLInputElement;
    await waitFor(() => expect(ageInput.value).not.toBe(""));
    // Still editable — the patient can override the prefilled value.
    await userEvent.clear(ageInput);
    await userEvent.type(ageInput, "40");
    expect(ageInput).toHaveValue(40);
  });

  it("shows what was automatically included from the profile and connected health data on the result screen", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/assessments") {
        return Promise.resolve({
          assessment: {
            id: "a1",
            urgencyLevel: "URGENT",
            recommendation: { explanation: "Elevated heart rate alongside chest pain." },
            healthSnapshot: {
              snapshot: {
                profile: { conditions: [{ name: "Diabetes" }], allergies: [] },
                healthMetrics: [{ label: "Heart rate", value: 118, unit: "bpm", recordedAt: "2026-01-01", source: "DEMO" }],
              },
            },
          },
          notice: "Not a diagnosis.",
        });
      }
      return Promise.reject(new Error("not mocked in this test"));
    });

    render(<SymptomChecker />);
    const next = () => screen.getByRole("button", { name: /next/i });

    await userEvent.type(screen.getByPlaceholderText("e.g. 34"), "30");
    await userEvent.click(next());
    await userEvent.click(await screen.findByRole("button", { name: "Male" }));
    await userEvent.click(next());
    await userEvent.type(await screen.findByPlaceholderText(/chest pain, sore throat/i), "chest pain");
    await userEvent.click(next());
    await userEvent.click(await screen.findByRole("button", { name: "5" }));
    await userEvent.click(next());
    await userEvent.type(await screen.findByPlaceholderText("e.g. 6"), "1");
    await userEvent.click(next());
    await userEvent.type(await screen.findByPlaceholderText("e.g. 37.0"), "37.2");
    for (let i = 0; i < 8; i++) {
      await userEvent.click(next());
    }
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/from your medical profile.*diabetes/i)).toBeInTheDocument();
    expect(await screen.findByText(/from connected health data.*heart rate 118bpm/i)).toBeInTheDocument();
  });
});
