import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockAssessmentFindUnique = vi.fn();
const mockAssessmentUpdate = vi.fn();
const mockPatientFindUnique = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: {
      findUnique: (...args: unknown[]) => mockAssessmentFindUnique(...args),
      update: (...args: unknown[]) => mockAssessmentUpdate(...args),
    },
    patient: { findUnique: (...args: unknown[]) => mockPatientFindUnique(...args) },
    auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}));

import { createApp } from "@/app";

const app = createApp();

function tokenFor(userId: string, role: string) {
  return jwt.sign({ sub: userId, role, email: "u@example.com" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

describe("Clinician urgency override (PATCH /api/assessments/:id)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssessmentFindUnique.mockResolvedValue({ id: "a1", urgencyLevel: "MODERATE", status: "AWAITING_REVIEW" });
    mockAssessmentUpdate.mockResolvedValue({ id: "a1", urgencyLevel: "URGENT" });
  });

  it("rejects a patient's attempt to override urgency with 403", async () => {
    const res = await request(app)
      .patch("/api/assessments/a1")
      .set("Authorization", `Bearer ${tokenFor("pat-1", "PATIENT")}`)
      .send({ urgencyLevel: "URGENT" });

    expect(res.status).toBe(403);
    expect(mockAssessmentUpdate).not.toHaveBeenCalled();
  });

  it.each(["NURSE", "DOCTOR", "ADMIN"])("lets a %s override urgency and audit-logs the change", async (role) => {
    const res = await request(app)
      .patch("/api/assessments/a1")
      .set("Authorization", `Bearer ${tokenFor("staff-1", role)}`)
      .send({ urgencyLevel: "URGENT" });

    expect(res.status).toBe(200);
    expect(mockAssessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1" }, data: expect.objectContaining({ urgencyLevel: "URGENT" }) })
    );

    const overrideLog = mockAuditCreate.mock.calls.find((c) => c[0].data.action === "URGENCY_OVERRIDDEN");
    expect(overrideLog).toBeDefined();
    expect(overrideLog![0].data.metadata).toEqual({ from: "MODERATE", to: "URGENT" });
  });

  it("does not audit-log an override when the submitted urgency matches the existing one", async () => {
    const res = await request(app)
      .patch("/api/assessments/a1")
      .set("Authorization", `Bearer ${tokenFor("staff-1", "DOCTOR")}`)
      .send({ urgencyLevel: "MODERATE" });

    expect(res.status).toBe(200);
    const overrideLog = mockAuditCreate.mock.calls.find((c) => c[0].data.action === "URGENCY_OVERRIDDEN");
    expect(overrideLog).toBeUndefined();
  });
});

describe("Assessment ownership isolation (GET /api/assessments/:id)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssessmentFindUnique.mockResolvedValue({
      id: "a1",
      patientId: "patient-owner",
      symptoms: [],
      recommendation: null,
      vitals: null,
      ruleTriggers: [],
      patient: { id: "patient-owner", user: {} },
      healthSnapshot: null,
    });
  });

  it("lets the owning patient view their own assessment", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "patient-owner", userId: "user-owner" });

    const res = await request(app)
      .get("/api/assessments/a1")
      .set("Authorization", `Bearer ${tokenFor("user-owner", "PATIENT")}`);

    expect(res.status).toBe(200);
  });

  it("blocks a different patient from viewing someone else's assessment with 403", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "patient-other", userId: "user-other" });

    const res = await request(app)
      .get("/api/assessments/a1")
      .set("Authorization", `Bearer ${tokenFor("user-other", "PATIENT")}`);

    expect(res.status).toBe(403);
  });

  it("lets clinical staff view any assessment regardless of patient ownership", async () => {
    const res = await request(app)
      .get("/api/assessments/a1")
      .set("Authorization", `Bearer ${tokenFor("staff-1", "NURSE")}`);

    expect(res.status).toBe(200);
    expect(mockPatientFindUnique).not.toHaveBeenCalled();
  });
});
