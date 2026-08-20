import { describe, it, expect } from "vitest";
import { buildUserPrompt } from "@/ai/prompts/triage-analysis.prompt";
import type { Assessment, Symptom } from "@prisma/client";
import type { PatientProfileContext } from "@/services/patient-context.service";
import type { HealthMetricContext } from "@/services/health-context.service";

const baseAssessment = {
  id: "a1",
  patientId: "p1",
  status: "IN_PROGRESS",
  intake: { primarySymptom: "chest pain", age: 45 },
  urgencyLevel: null,
  reviewedById: null,
  reviewedAt: null,
  clinicianNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  symptoms: [] as Symptom[],
} as unknown as Assessment & { symptoms: Symptom[] };

const profile: PatientProfileContext = {
  age: 52,
  sex: "Female",
  conditions: [{ name: "Diabetes", status: "ACTIVE" }, { name: "Hypertension", status: "ACTIVE" }],
  allergies: [{ substance: "Penicillin", severity: "severe" }],
  medications: [{ name: "Metformin", dosage: "500mg" }],
  surgeries: [],
};

const healthMetrics: HealthMetricContext[] = [
  {
    metricType: "HEART_RATE",
    label: "Heart rate",
    value: 118,
    unit: "bpm",
    recordedAt: new Date("2026-01-01T00:00:00Z"),
    source: "DEMO",
  },
];

describe("buildUserPrompt — automatic patient context", () => {
  it("omits the profile and health sections entirely when neither is provided", () => {
    const prompt = buildUserPrompt(baseAssessment);
    expect(prompt).not.toContain("stored medical profile");
    expect(prompt).not.toContain("connected health-device data");
  });

  it("includes the patient's stored medical profile when provided, clearly labeled as not entered this visit", () => {
    const prompt = buildUserPrompt(baseAssessment, profile);
    expect(prompt).toContain("Patient's stored medical profile (persistent, not entered this visit):");
    expect(prompt).toContain("Diabetes, Hypertension");
    expect(prompt).toContain("Penicillin (severe)");
    expect(prompt).toContain("Metformin (500mg)");
    // No health-device section when none was passed.
    expect(prompt).not.toContain("connected health-device data");
  });

  it("includes recent connected health-device data when provided, clearly labeled as patient-authorized", () => {
    const prompt = buildUserPrompt(baseAssessment, undefined, healthMetrics);
    expect(prompt).toContain("Recently connected health-device data (patient-authorized readings, most recent per metric):");
    expect(prompt).toContain("Heart rate: 118 bpm");
    expect(prompt).toContain("source: DEMO");
    expect(prompt).not.toContain("stored medical profile");
  });

  it("still includes the current-visit intake and symptoms alongside both context sections", () => {
    const prompt = buildUserPrompt(baseAssessment, profile, healthMetrics);
    expect(prompt).toContain("Patient intake (this visit):");
    expect(prompt).toContain("chest pain");
    expect(prompt).toContain("stored medical profile");
    expect(prompt).toContain("connected health-device data");
  });

  it("renders an empty-profile patient without fabricating any conditions", () => {
    const emptyProfile: PatientProfileContext = { age: 30, sex: "Male", conditions: [], allergies: [], medications: [], surgeries: [] };
    const prompt = buildUserPrompt(baseAssessment, emptyProfile);
    expect(prompt).toContain("Existing conditions: none on record");
    expect(prompt).toContain("Allergies: none on record");
  });
});
