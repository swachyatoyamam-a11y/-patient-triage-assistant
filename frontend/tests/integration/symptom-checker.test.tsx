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

describe("SymptomChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("drives through every step and submits, showing the result panel on success", async () => {
    apiFetchMock.mockResolvedValueOnce({
      assessment: {
        id: "a1",
        urgencyLevel: "ROUTINE",
        recommendation: { explanation: "Symptoms appear mild." },
      },
      notice: "This is not a medical diagnosis. Please consult a qualified healthcare professional.",
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

    await userEvent.click(next()); // temperature — optional, skip
    await userEvent.click(next()); // additional symptoms — optional, skip
    await userEvent.click(next()); // medical history — optional, skip
    await userEvent.click(next()); // medications — optional, skip

    // sex=Male means the pregnancy step does not appear here — straight
    // to lifestyle factors (the `skip` logic actually being exercised).
    expect(await screen.findByText(/lifestyle/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const [path, options] = apiFetchMock.mock.calls[0]!;
    expect(path).toBe("/assessments");
    const body = JSON.parse((options as { body: string }).body);
    expect(body.age).toBe(30);
    expect(body.sex).toBe("Male");
    expect(body.primarySymptom).toBe("sore throat");
    expect(body.painLevel).toBe(3);
    expect(body.durationHours).toBe(12);
    expect(body.isPregnant).toBeUndefined();

    expect(await screen.findByText("Your assessment has been submitted")).toBeInTheDocument();
    expect(screen.getByText("Symptoms appear mild.")).toBeInTheDocument();
  });
});
