import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockPatientFindUnique = vi.fn();
const mockConnectionFindMany = vi.fn();
const mockConnectionUpsert = vi.fn();
const mockConnectionFindUnique = vi.fn();
const mockConnectionFindUniqueOrThrow = vi.fn();
const mockConnectionUpdate = vi.fn();
const mockMetricCreateMany = vi.fn();
const mockMetricFindMany = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: { findUnique: (...args: unknown[]) => mockPatientFindUnique(...args) },
    healthConnection: {
      findMany: (...args: unknown[]) => mockConnectionFindMany(...args),
      upsert: (...args: unknown[]) => mockConnectionUpsert(...args),
      findUnique: (...args: unknown[]) => mockConnectionFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockConnectionFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockConnectionUpdate(...args),
    },
    healthMetric: {
      createMany: (...args: unknown[]) => mockMetricCreateMany(...args),
      findMany: (...args: unknown[]) => mockMetricFindMany(...args),
    },
    auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}));

import { createApp } from "@/app";

const app = createApp();
const USER_ID = "user-1";
const PATIENT_ID = "patient-1";

function token() {
  return jwt.sign({ sub: USER_ID, role: "PATIENT", email: "p@example.com" }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
}

describe("Health data endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatientFindUnique.mockResolvedValue({ id: PATIENT_ID, userId: USER_ID });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/health-data/connections");
    expect(res.status).toBe(401);
  });

  it("lists the provider catalog including unconfigured providers, without hiding them", async () => {
    const res = await request(app).get("/api/health-data/providers").set("Authorization", `Bearer ${token()}`);
    expect(res.status).toBe(200);
    const ids = res.body.providers.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["DEMO", "FITBIT", "APPLE_HEALTH"]));

    const demo = res.body.providers.find((p: { id: string }) => p.id === "DEMO");
    expect(demo.configured).toBe(true);

    const apple = res.body.providers.find((p: { id: string }) => p.id === "APPLE_HEALTH");
    expect(apple.configured).toBe(false);
    expect(apple.unavailableReason).toMatch(/no public web API/i);

    const fitbit = res.body.providers.find((p: { id: string }) => p.id === "FITBIT");
    expect(fitbit.configured).toBe(false); // no FITBIT_CLIENT_ID set in test env
  });

  it("connects the Demo provider immediately and seeds metrics — no OAuth round trip", async () => {
    mockConnectionUpsert.mockResolvedValueOnce({ id: "conn-1", patientId: PATIENT_ID, provider: "DEMO" });
    mockConnectionFindUniqueOrThrow.mockResolvedValueOnce({ id: "conn-1", patientId: PATIENT_ID });

    const res = await request(app)
      .post("/api/health-data/connections/DEMO/connect")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.authUrl).toBeUndefined(); // no redirect needed for Demo
    expect(res.body.connection).toBeDefined();
    expect(mockMetricCreateMany).toHaveBeenCalledTimes(1);
    const createdMetrics = mockMetricCreateMany.mock.calls[0]![0].data;
    expect(createdMetrics.length).toBeGreaterThan(0);
    expect(createdMetrics.every((m: { metadata: { synthetic: boolean } }) => m.metadata.synthetic === true)).toBe(true);
  });

  it("returns a clear 400 (not a crash) when connecting an unconfigured provider like Fitbit", async () => {
    const res = await request(app)
      .post("/api/health-data/connections/FITBIT/connect")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not yet configured/i);
    expect(mockConnectionUpsert).not.toHaveBeenCalled();
  });

  it("disconnecting wipes stored tokens and marks the connection DISCONNECTED", async () => {
    mockConnectionFindUnique.mockResolvedValueOnce({ id: "conn-1", patientId: PATIENT_ID, provider: "DEMO" });

    const res = await request(app)
      .delete("/api/health-data/connections/DEMO")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(204);
    const updateArgs = mockConnectionUpdate.mock.calls[0]![0];
    expect(updateArgs.data.status).toBe("DISCONNECTED");
    expect(updateArgs.data.accessTokenEnc).toBeNull();
    expect(updateArgs.data.refreshTokenEnc).toBeNull();
  });

  it("404s when disconnecting a provider that was never connected", async () => {
    mockConnectionFindUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete("/api/health-data/connections/DEMO")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(404);
  });

  it("scopes /metrics to the authenticated patient only", async () => {
    mockMetricFindMany.mockResolvedValueOnce([]);
    await request(app).get("/api/health-data/metrics").set("Authorization", `Bearer ${token()}`);

    const queryArgs = mockMetricFindMany.mock.calls[0]![0];
    expect(queryArgs.where.patientId).toBe(PATIENT_ID);
  });
});
