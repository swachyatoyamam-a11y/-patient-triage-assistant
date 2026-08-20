import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

import HealthDataPage from "@/app/(patient)/health-data/page";

const PROVIDERS = [
  { id: "DEMO", label: "Demo Health Data", configured: true, requiresOAuth: false, unavailableReason: null },
  {
    id: "FITBIT",
    label: "Fitbit",
    configured: false,
    requiresOAuth: true,
    unavailableReason: "Requires a Fitbit developer app.",
  },
  {
    id: "APPLE_HEALTH",
    label: "Apple Health",
    configured: false,
    requiresOAuth: false,
    unavailableReason: "Apple Health has no public web API — requires a native companion app.",
  },
];

describe("HealthDataPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows every provider, including unconfigured ones, with an honest reason instead of hiding them", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/health-data/providers") return Promise.resolve({ providers: PROVIDERS });
      if (path === "/health-data/connections") return Promise.resolve({ connections: [] });
      if (path === "/health-data/metrics") return Promise.resolve({ metrics: [] });
      return Promise.reject(new Error("unexpected call"));
    });

    render(<HealthDataPage />);

    expect(await screen.findByText("Demo Health Data")).toBeInTheDocument();
    expect(screen.getByText("Fitbit")).toBeInTheDocument();
    expect(screen.getByText("Apple Health")).toBeInTheDocument();
    expect(screen.getByText(/Requires a Fitbit developer app/)).toBeInTheDocument();
    expect(screen.getByText(/no public web API/)).toBeInTheDocument();

    // Unconfigured providers' Connect buttons are disabled, not hidden.
    const connectButtons = screen.getAllByRole("button", { name: /connect$/i });
    expect(connectButtons).toHaveLength(3);

    const fitbitCard = screen.getByText("Fitbit").closest('[class*="rounded-card"]') as HTMLElement;
    expect(within(fitbitCard).getByRole("button", { name: /connect$/i })).toBeDisabled();
  });

  it("connects the Demo provider without leaving the page (no authUrl redirect)", async () => {
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === "/health-data/providers") return Promise.resolve({ providers: PROVIDERS });
      if (path === "/health-data/connections") return Promise.resolve({ connections: [] });
      if (path === "/health-data/metrics") return Promise.resolve({ metrics: [] });
      if (path === "/health-data/connections/DEMO/connect" && opts?.method === "POST") {
        return Promise.resolve({ connection: { id: "c1" } });
      }
      return Promise.reject(new Error("unexpected call: " + path));
    });

    render(<HealthDataPage />);
    await screen.findByText("Demo Health Data");
    const demoCard = screen.getByText("Demo Health Data").closest('[class*="rounded-card"]') as HTMLElement;
    const connectBtn = within(demoCard).getByRole("button", { name: /connect$/i });
    await userEvent.click(connectBtn);

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/health-data/connections/DEMO/connect", expect.objectContaining({ method: "POST" }));
  });

  it("shows Sync/Disconnect once connected, and disconnecting calls DELETE", async () => {
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === "/health-data/providers") return Promise.resolve({ providers: PROVIDERS });
      if (path === "/health-data/connections") {
        return Promise.resolve({
          connections: [
            { id: "c1", provider: "DEMO", status: "CONNECTED", scopes: [], lastSyncedAt: null, connectedAt: "2026-01-01", disconnectedAt: null },
          ],
        });
      }
      if (path === "/health-data/metrics") return Promise.resolve({ metrics: [] });
      if (path === "/health-data/connections/DEMO" && opts?.method === "DELETE") {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error("unexpected call: " + path));
    });

    render(<HealthDataPage />);
    const disconnectBtn = await screen.findByRole("button", { name: /disconnect/i });
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();

    await userEvent.click(disconnectBtn);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/health-data/connections/DEMO", expect.objectContaining({ method: "DELETE" }));
  });
});
