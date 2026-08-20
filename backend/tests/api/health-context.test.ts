import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConnectionFindMany = vi.fn();
const mockMetricFindMany = vi.fn();
const mockPatientFindUniqueOrThrow = vi.fn();
const mockConditionFindMany = vi.fn();
const mockAllergyFindMany = vi.fn();
const mockMedicationFindMany = vi.fn();
const mockSurgeryFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    healthConnection: { findMany: (...args: unknown[]) => mockConnectionFindMany(...args) },
    healthMetric: { findMany: (...args: unknown[]) => mockMetricFindMany(...args) },
    patient: { findUniqueOrThrow: (...args: unknown[]) => mockPatientFindUniqueOrThrow(...args) },
    medicalCondition: { findMany: (...args: unknown[]) => mockConditionFindMany(...args) },
    allergy: { findMany: (...args: unknown[]) => mockAllergyFindMany(...args) },
    medication: { findMany: (...args: unknown[]) => mockMedicationFindMany(...args) },
    surgery: { findMany: (...args: unknown[]) => mockSurgeryFindMany(...args) },
  },
}));

import { healthContextService } from "@/services/health-context.service";
import { patientContextService } from "@/services/patient-context.service";

describe("healthContextService.getRecentHealthContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns nothing when the patient has no CONNECTED provider", async () => {
    mockConnectionFindMany.mockResolvedValueOnce([]);

    const result = await healthContextService.getRecentHealthContext("patient-1");

    expect(result).toEqual([]);
    // Must not even query metrics if there's nothing authorized to read from.
    expect(mockMetricFindMany).not.toHaveBeenCalled();
  });

  it("only queries metrics tied to CONNECTED connections — a disconnected provider's data never reaches the AI even though the rows still exist", async () => {
    // findMany is already filtered by status: "CONNECTED" in the where
    // clause, so a disconnected connection simply never appears here.
    mockConnectionFindMany.mockResolvedValueOnce([{ id: "conn-active" }]);
    mockMetricFindMany.mockResolvedValueOnce([
      {
        metricType: "HEART_RATE",
        value: 72,
        unit: "bpm",
        recordedAt: new Date(),
        source: "DEMO",
        connectionId: "conn-active",
      },
    ]);

    const result = await healthContextService.getRecentHealthContext("patient-1");

    expect(mockConnectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "CONNECTED" }) })
    );
    const metricQueryArgs = mockMetricFindMany.mock.calls[0]![0];
    expect(metricQueryArgs.where.connectionId).toEqual({ in: ["conn-active"] });
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe("Heart rate");
  });

  it("keeps only the most recent reading per metric type", async () => {
    mockConnectionFindMany.mockResolvedValueOnce([{ id: "conn-1" }]);
    mockMetricFindMany.mockResolvedValueOnce([
      { metricType: "HEART_RATE", value: 80, unit: "bpm", recordedAt: new Date("2026-01-02"), source: "DEMO", connectionId: "conn-1" },
      { metricType: "HEART_RATE", value: 70, unit: "bpm", recordedAt: new Date("2026-01-01"), source: "DEMO", connectionId: "conn-1" },
    ]);

    const result = await healthContextService.getRecentHealthContext("patient-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(80); // findMany is ordered desc, so the first row wins
  });
});

describe("patientContextService.getProfileContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only includes ACTIVE conditions and active medications, not resolved/discontinued ones", async () => {
    mockPatientFindUniqueOrThrow.mockResolvedValueOnce({ dateOfBirth: new Date("1990-01-01"), sex: "Female" });
    mockConditionFindMany.mockResolvedValueOnce([{ name: "Diabetes", status: "ACTIVE" }]);
    mockAllergyFindMany.mockResolvedValueOnce([]);
    mockMedicationFindMany.mockResolvedValueOnce([{ name: "Metformin", dosage: "500mg" }]);
    mockSurgeryFindMany.mockResolvedValueOnce([]);

    await patientContextService.getProfileContext("patient-1");

    expect(mockConditionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) })
    );
    expect(mockMedicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });
});
