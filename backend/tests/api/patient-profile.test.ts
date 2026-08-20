import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockPatientFindUnique = vi.fn();
const mockPatientFindUniqueOrThrow = vi.fn();
const mockPatientUpdate = vi.fn();
const mockConditionFindMany = vi.fn();
const mockConditionCreate = vi.fn();
const mockConditionFindUnique = vi.fn();
const mockConditionUpdate = vi.fn();
const mockConditionDelete = vi.fn();
const mockAllergyFindMany = vi.fn();
const mockAllergyCreate = vi.fn();
const mockAllergyFindUnique = vi.fn();
const mockMedicationFindMany = vi.fn();
const mockSurgeryFindMany = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: {
      findUnique: (...args: unknown[]) => mockPatientFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockPatientFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockPatientUpdate(...args),
    },
    medicalCondition: {
      findMany: (...args: unknown[]) => mockConditionFindMany(...args),
      create: (...args: unknown[]) => mockConditionCreate(...args),
      findUnique: (...args: unknown[]) => mockConditionFindUnique(...args),
      update: (...args: unknown[]) => mockConditionUpdate(...args),
      delete: (...args: unknown[]) => mockConditionDelete(...args),
    },
    allergy: {
      findMany: (...args: unknown[]) => mockAllergyFindMany(...args),
      create: (...args: unknown[]) => mockAllergyCreate(...args),
      findUnique: (...args: unknown[]) => mockAllergyFindUnique(...args),
    },
    medication: { findMany: (...args: unknown[]) => mockMedicationFindMany(...args) },
    surgery: { findMany: (...args: unknown[]) => mockSurgeryFindMany(...args) },
    auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}));

import { createApp } from "@/app";

const app = createApp();

const PATIENT_A_USER_ID = "user-patient-a";
const PATIENT_A_PATIENT_ID = "patient-a";
const PATIENT_B_PATIENT_ID = "patient-b";

function tokenFor(userId: string, role = "PATIENT") {
  return jwt.sign({ sub: userId, role, email: "patient@example.com" }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
}

describe("Patient medical profile endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatientFindUnique.mockResolvedValue({ id: PATIENT_A_PATIENT_ID, userId: PATIENT_A_USER_ID });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/patients/me/medical-profile");
    expect(res.status).toBe(401);
  });

  it("rejects non-patient roles", async () => {
    const res = await request(app)
      .get("/api/patients/me/medical-profile")
      .set("Authorization", `Bearer ${tokenFor("nurse-1", "NURSE")}`);
    expect(res.status).toBe(403);
  });

  it("returns the full structured profile for the authenticated patient", async () => {
    mockPatientFindUniqueOrThrow.mockResolvedValueOnce({
      dateOfBirth: new Date("1990-01-01"),
      sex: "Female",
      bloodType: "O+",
      emergencyContactName: "Jane Doe",
      emergencyContactPhone: "+1-555-0000",
    });
    mockConditionFindMany.mockResolvedValueOnce([{ id: "c1", name: "Diabetes" }]);
    mockAllergyFindMany.mockResolvedValueOnce([{ id: "a1", substance: "Penicillin" }]);
    mockMedicationFindMany.mockResolvedValueOnce([]);
    mockSurgeryFindMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/patients/me/medical-profile")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.conditions).toEqual([{ id: "c1", name: "Diabetes" }]);
    expect(res.body.allergies).toEqual([{ id: "a1", substance: "Penicillin" }]);
  });

  it("adds a condition and audit-logs the change", async () => {
    mockConditionCreate.mockResolvedValueOnce({ id: "c2", name: "Hypertension", status: "ACTIVE" });

    const res = await request(app)
      .post("/api/patients/me/conditions")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`)
      .send({ name: "Hypertension" });

    expect(res.status).toBe(201);
    expect(mockConditionCreate).toHaveBeenCalledWith({
      data: { patientId: PATIENT_A_PATIENT_ID, name: "Hypertension", status: "ACTIVE" },
    });
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MEDICAL_PROFILE_UPDATED" }) })
    );
  });

  it("rejects an empty condition name", async () => {
    const res = await request(app)
      .post("/api/patients/me/conditions")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`)
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("lets a patient update their own condition", async () => {
    mockConditionFindUnique.mockResolvedValueOnce({ id: "c1", patientId: PATIENT_A_PATIENT_ID });
    mockConditionUpdate.mockResolvedValueOnce({ id: "c1", status: "RESOLVED" });

    const res = await request(app)
      .patch("/api/patients/me/conditions/c1")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`)
      .send({ status: "RESOLVED" });

    expect(res.status).toBe(200);
    expect(res.body.condition.status).toBe("RESOLVED");
  });

  it("does not let a patient edit another patient's condition (ownership isolation)", async () => {
    mockConditionFindUnique.mockResolvedValueOnce({ id: "c99", patientId: PATIENT_B_PATIENT_ID });

    const res = await request(app)
      .patch("/api/patients/me/conditions/c99")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`)
      .send({ status: "RESOLVED" });

    expect(res.status).toBe(404);
    expect(mockConditionUpdate).not.toHaveBeenCalled();
  });

  it("does not let a patient delete another patient's allergy (ownership isolation)", async () => {
    mockAllergyFindUnique.mockResolvedValueOnce({ id: "a99", patientId: PATIENT_B_PATIENT_ID });

    const res = await request(app)
      .delete("/api/patients/me/allergies/a99")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`);

    expect(res.status).toBe(404);
  });

  it("removes a condition belonging to the caller", async () => {
    mockConditionFindUnique.mockResolvedValueOnce({ id: "c1", patientId: PATIENT_A_PATIENT_ID });

    const res = await request(app)
      .delete("/api/patients/me/conditions/c1")
      .set("Authorization", `Bearer ${tokenFor(PATIENT_A_USER_ID)}`);

    expect(res.status).toBe(204);
    expect(mockConditionDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
