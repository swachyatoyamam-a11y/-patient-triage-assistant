import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockPatientCount = vi.fn();
const mockAssessmentFindMany = vi.fn();
const mockRecommendationAggregate = vi.fn();
const mockRecommendationCount = vi.fn();
const mockAuditLogCount = vi.fn();
const mockQueryRaw = vi.fn();
const mockConditionGroupBy = vi.fn();
const mockVitalsCount = vi.fn();
const mockConditionFindMany = vi.fn();
const mockPatientFindUnique = vi.fn();
const mockHealthMetricFindMany = vi.fn();
const mockAuditLogFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: {
      count: (...args: unknown[]) => mockPatientCount(...args),
      findUnique: (...args: unknown[]) => mockPatientFindUnique(...args),
    },
    assessment: { findMany: (...args: unknown[]) => mockAssessmentFindMany(...args) },
    recommendation: {
      aggregate: (...args: unknown[]) => mockRecommendationAggregate(...args),
      count: (...args: unknown[]) => mockRecommendationCount(...args),
    },
    auditLog: {
      count: (...args: unknown[]) => mockAuditLogCount(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
    },
    medicalCondition: {
      groupBy: (...args: unknown[]) => mockConditionGroupBy(...args),
      findMany: (...args: unknown[]) => mockConditionFindMany(...args),
    },
    vitals: { count: (...args: unknown[]) => mockVitalsCount(...args) },
    healthMetric: { findMany: (...args: unknown[]) => mockHealthMetricFindMany(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { createApp } from "@/app";

const app = createApp();

function tokenFor(role: string) {
  return jwt.sign({ sub: "staff-1", role, email: "staff@example.com" }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
}

describe("GET /api/analytics/extended-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatientCount.mockResolvedValue(0);
    mockAssessmentFindMany.mockResolvedValue([]);
    mockRecommendationAggregate.mockResolvedValue({ _count: 0 });
    mockRecommendationCount.mockResolvedValue(0);
    mockAuditLogCount.mockResolvedValue(0);
    mockQueryRaw.mockResolvedValue([]);
    mockConditionGroupBy.mockResolvedValue([]);
    mockVitalsCount.mockResolvedValue(0);
    mockConditionFindMany.mockResolvedValue([]);
  });

  it("rejects a patient's request with 403", async () => {
    const res = await request(app)
      .get("/api/analytics/extended-summary")
      .set("Authorization", `Bearer ${tokenFor("PATIENT")}`);
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/analytics/extended-summary");
    expect(res.status).toBe(401);
  });

  it("computes the AI escalation rate from wasEscalatedByAi against total recommendations", async () => {
    mockRecommendationAggregate.mockResolvedValueOnce({ _count: 4 });
    mockRecommendationCount.mockResolvedValueOnce(1); // 1 of 4 escalated

    const res = await request(app)
      .get("/api/analytics/extended-summary")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`);

    expect(res.status).toBe(200);
    expect(res.body.aiEscalationRate).toBe(25);
  });

  it("only counts a patient as high-risk when a high-risk condition AND a recent severe assessment both exist", async () => {
    // First assessment.findMany call = activePatientIds, second = reviewPatientIds.
    mockAssessmentFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ patientId: "p1" }]); // recentSeverePatients

    mockConditionFindMany.mockResolvedValueOnce([{ patientId: "p1" }]); // has a high-risk condition

    const res = await request(app)
      .get("/api/analytics/extended-summary")
      .set("Authorization", `Bearer ${tokenFor("NURSE")}`);

    expect(res.status).toBe(200);
    expect(res.body.highRiskPatientCount).toBe(1);
  });

  it("skips the recent-severe-assessment lookup entirely when no patient has a high-risk condition", async () => {
    mockConditionFindMany.mockResolvedValueOnce([]); // nobody has a high-risk condition

    const res = await request(app)
      .get("/api/analytics/extended-summary")
      .set("Authorization", `Bearer ${tokenFor("DOCTOR")}`);

    expect(res.status).toBe(200);
    expect(res.body.highRiskPatientCount).toBe(0);
    // Only the 2 base findMany calls (active/review patients) — no 3rd call.
    expect(mockAssessmentFindMany).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/analytics/patients/:patientId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404s when the patient doesn't exist", async () => {
    mockPatientFindUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/api/analytics/patients/does-not-exist")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`);

    expect(res.status).toBe(404);
  });

  it("aggregates patient info, assessments, health metrics, and audit history in one response", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({
      id: "p1",
      userId: "user-1",
      user: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: null },
      medicalConditions: [],
      allergies: [],
      medications: [],
      surgeries: [],
      healthConnections: [],
    });
    mockAssessmentFindMany.mockResolvedValueOnce([{ id: "a1" }]);
    mockHealthMetricFindMany.mockResolvedValueOnce([{ id: "m1" }]);
    mockAuditLogFindMany.mockResolvedValueOnce([{ id: "log1" }]);

    const res = await request(app)
      .get("/api/analytics/patients/p1")
      .set("Authorization", `Bearer ${tokenFor("NURSE")}`);

    expect(res.status).toBe(200);
    expect(res.body.patient.id).toBe("p1");
    expect(res.body.assessments).toEqual([{ id: "a1" }]);
    expect(res.body.recentMetrics).toEqual([{ id: "m1" }]);
    expect(res.body.auditLogs).toEqual([{ id: "log1" }]);
  });
});
