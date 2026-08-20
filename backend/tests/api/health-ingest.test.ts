import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockPatientFindUnique = vi.fn();
const mockTxConnectionUpsert = vi.fn();
const mockTxConnectionUpdate = vi.fn();
const mockTxMetricCreateMany = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: { findUnique: (...args: unknown[]) => mockPatientFindUnique(...args) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        healthConnection: {
          upsert: (...args: unknown[]) => mockTxConnectionUpsert(...args),
          update: (...args: unknown[]) => mockTxConnectionUpdate(...args),
        },
        healthMetric: {
          createMany: (...args: unknown[]) => mockTxMetricCreateMany(...args),
        },
      }),
    auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}));

import { createApp } from "@/app";

const app = createApp();
const USER_ID = "user-1";
const PATIENT_ID = "patient-1";

function token(userId = USER_ID) {
  return jwt.sign({ sub: userId, role: "PATIENT", email: "p@example.com" }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
}

function validReading(overrides: Record<string, unknown> = {}) {
  return {
    metricType: "HEART_RATE",
    value: 72,
    unit: "bpm",
    recordedAt: new Date().toISOString(),
    externalId: "hk-sample-1",
    ...overrides,
  };
}

describe("POST /api/health-data/connections/:provider/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatientFindUnique.mockResolvedValue({ id: PATIENT_ID, userId: USER_ID });
    mockTxConnectionUpsert.mockResolvedValue({ id: "conn-1", patientId: PATIENT_ID, provider: "APPLE_HEALTH" });
    mockTxConnectionUpdate.mockResolvedValue({});
    mockTxMetricCreateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/health-data/connections/APPLE_HEALTH/ingest")
      .send({ readings: [validReading()] });
    expect(res.status).toBe(401);
    expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
  });

  it("404s when the authenticated user has no patient profile (ownership resolution failure)", async () => {
    mockPatientFindUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/health-data/connections/APPLE_HEALTH/ingest")
      .set("Authorization", `Bearer ${token()}`)
      .send({ readings: [validReading()] });
    expect(res.status).toBe(404);
  });

  it("accepts a valid Apple Health ingestion and persists via the shared HealthMetric path", async () => {
    const res = await request(app)
      .post("/api/health-data/connections/APPLE_HEALTH/ingest")
      .set("Authorization", `Bearer ${token()}`)
      .send({ readings: [validReading()] });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ connectionId: "conn-1", submitted: 1, ingested: 1, skipped: 0 });
    expect(mockTxMetricCreateMany).toHaveBeenCalledTimes(1);
    const createArgs = mockTxMetricCreateMany.mock.calls[0]![0];
    expect(createArgs.skipDuplicates).toBe(true);
    expect(createArgs.data[0]).toMatchObject({
      patientId: PATIENT_ID,
      source: "APPLE_HEALTH",
      metricType: "HEART_RATE",
      value: 72,
      unit: "bpm",
      externalRecordId: "hk-sample-1",
    });
  });

  it("identifies Apple Health readings with source APPLE_HEALTH", async () => {
    await request(app)
      .post("/api/health-data/connections/APPLE_HEALTH/ingest")
      .set("Authorization", `Bearer ${token()}`)
      .send({ readings: [validReading()] });

    const upsertArgs = mockTxConnectionUpsert.mock.calls[0]![0];
    expect(upsertArgs.create.provider).toBe("APPLE_HEALTH");
    const createArgs = mockTxMetricCreateMany.mock.calls[0]![0];
    expect(createArgs.data.every((r: { source: string }) => r.source === "APPLE_HEALTH")).toBe(true);
  });

  it("identifies Google Health Connect readings with source GOOGLE_HEALTH_CONNECT, through the same endpoint code path", async () => {
    mockTxConnectionUpsert.mockResolvedValueOnce({
      id: "conn-2",
      patientId: PATIENT_ID,
      provider: "GOOGLE_HEALTH_CONNECT",
    });

    const res = await request(app)
      .post("/api/health-data/connections/GOOGLE_HEALTH_CONNECT/ingest")
      .set("Authorization", `Bearer ${token()}`)
      .send({ readings: [validReading({ externalId: "hc-record-1" })] });

    expect(res.status).toBe(201);
    const upsertArgs = mockTxConnectionUpsert.mock.calls[0]![0];
    expect(upsertArgs.create.provider).toBe("GOOGLE_HEALTH_CONNECT");
    const createArgs = mockTxMetricCreateMany.mock.calls[0]![0];
    expect(createArgs.data.every((r: { source: string }) => r.source === "GOOGLE_HEALTH_CONNECT")).toBe(true);
  });

  it("relies on skipDuplicates + externalRecordId for idempotent resubmission, and reports skipped count", async () => {
    // Simulate two readings submitted, one already existing (createMany
    // with skipDuplicates silently drops it — Prisma reports count: 1).
    mockTxMetricCreateMany.mockResolvedValueOnce({ count: 1 });

    const res = await request(app)
      .post("/api/health-data/connections/APPLE_HEALTH/ingest")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        readings: [validReading({ externalId: "dup-1" }), validReading({ externalId: "dup-2", value: 75 })],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ connectionId: "conn-1", submitted: 2, ingested: 1, skipped: 1 });
    expect(mockTxMetricCreateMany.mock.calls[0]![0].skipDuplicates).toBe(true);
  });

  describe("payload validation", () => {
    it("rejects an unrecognized metric type", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/APPLE_HEALTH/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [validReading({ metricType: "BLOOD_ALCOHOL_LEVEL" })] });
      expect(res.status).toBe(400);
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });

    it("rejects a value outside the physiologically plausible range for that metric", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/APPLE_HEALTH/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [validReading({ metricType: "HEART_RATE", value: 900 })] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Validation failed");
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });

    it("rejects a unit that doesn't match the metric type instead of silently converting", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/APPLE_HEALTH/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [validReading({ metricType: "TEMPERATURE_C", value: 98.6, unit: "F" })] });
      expect(res.status).toBe(400);
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });

    it("rejects a recordedAt timestamp in the future", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/APPLE_HEALTH/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [validReading({ recordedAt: new Date(Date.now() + 3600_000).toISOString() })] });
      expect(res.status).toBe(400);
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });

    it("rejects an empty readings array", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/APPLE_HEALTH/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [] });
      expect(res.status).toBe(400);
    });

    it("rejects a batch larger than the configured maximum", async () => {
      const readings = Array.from({ length: 501 }, () => validReading());
      const res = await request(app)
        .post("/api/health-data/connections/APPLE_HEALTH/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings });
      expect(res.status).toBe(400);
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });
  });

  describe("existing Demo/Fitbit functionality stays on its own pull-based path", () => {
    it("rejects ingest attempts against DEMO — it syncs automatically, not via push", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/DEMO/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [validReading()] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not accept ingested readings/i);
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });

    it("rejects ingest attempts against FITBIT — it syncs via OAuth, not push", async () => {
      const res = await request(app)
        .post("/api/health-data/connections/FITBIT/ingest")
        .set("Authorization", `Bearer ${token()}`)
        .send({ readings: [validReading()] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not accept ingested readings/i);
      expect(mockTxMetricCreateMany).not.toHaveBeenCalled();
    });
  });
});
