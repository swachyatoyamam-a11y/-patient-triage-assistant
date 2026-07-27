import { describe, it, expect } from "vitest";
import { createAssessmentSchema } from "@/validators/assessment.validator";

const validBase = {
  age: 34,
  sex: "Female",
  primarySymptom: "chest pain",
  painLevel: 5,
  durationHours: 6,
  temperatureCelsius: 37.2,
  additionalSymptoms: [],
  medicalHistory: [],
  currentMedications: [],
  lifestyleFactors: [],
};

describe("createAssessmentSchema — temperature", () => {
  it("accepts a valid Celsius temperature within range", () => {
    expect(() => createAssessmentSchema.parse(validBase)).not.toThrow();
  });

  it("is mandatory — rejects a missing temperature", () => {
    const { temperatureCelsius: _omit, ...withoutTemp } = validBase;
    expect(() => createAssessmentSchema.parse(withoutTemp)).toThrow();
  });

  it("rejects a temperature below 30°C", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, temperatureCelsius: 29.9 })).toThrow(
      /30°C and 45°C/
    );
  });

  it("rejects a temperature above 45°C", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, temperatureCelsius: 45.1 })).toThrow(
      /30°C and 45°C/
    );
  });

  it("accepts the boundary values 30 and 45", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, temperatureCelsius: 30 })).not.toThrow();
    expect(() => createAssessmentSchema.parse({ ...validBase, temperatureCelsius: 45 })).not.toThrow();
  });
});

describe("createAssessmentSchema — pulse rate", () => {
  it("is optional", () => {
    expect(() => createAssessmentSchema.parse(validBase)).not.toThrow();
  });

  it("accepts a value within 20-250 bpm", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, heartRate: 78 })).not.toThrow();
  });

  it("rejects a value below 20 or above 250", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, heartRate: 19 })).toThrow(/20 and 250/);
    expect(() => createAssessmentSchema.parse({ ...validBase, heartRate: 251 })).toThrow(/20 and 250/);
  });
});

describe("createAssessmentSchema — SpO2", () => {
  it("accepts a value within 50-100%", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, oxygenSaturation: 97 })).not.toThrow();
  });

  it("rejects a value below 50 or above 100", () => {
    expect(() => createAssessmentSchema.parse({ ...validBase, oxygenSaturation: 49 })).toThrow(/50% and 100%/);
    expect(() => createAssessmentSchema.parse({ ...validBase, oxygenSaturation: 101 })).toThrow(/50% and 100%/);
  });
});

describe("createAssessmentSchema — blood pressure", () => {
  it("accepts systolic/diastolic within range with systolic > diastolic", () => {
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 120, bloodPressureDiastolic: 80 })
    ).not.toThrow();
  });

  it("rejects systolic outside 50-250", () => {
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 49, bloodPressureDiastolic: 80 })
    ).toThrow(/50 and 250/);
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 251, bloodPressureDiastolic: 80 })
    ).toThrow(/50 and 250/);
  });

  it("rejects diastolic outside 30-150", () => {
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 120, bloodPressureDiastolic: 29 })
    ).toThrow(/30 and 150/);
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 120, bloodPressureDiastolic: 151 })
    ).toThrow(/30 and 150/);
  });

  it("rejects systolic <= diastolic", () => {
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 80, bloodPressureDiastolic: 80 })
    ).toThrow(/[Ss]ystolic.*greater than diastolic/);
    expect(() =>
      createAssessmentSchema.parse({ ...validBase, bloodPressureSystolic: 70, bloodPressureDiastolic: 90 })
    ).toThrow(/[Ss]ystolic.*greater than diastolic/);
  });
});
