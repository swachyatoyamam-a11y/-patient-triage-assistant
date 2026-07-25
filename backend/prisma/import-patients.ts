// Reusable patient-data importer. Reads a .xlsx/.xls/.csv/.json file of
// patient triage records and creates real User/Patient/Assessment/Symptom/
// Vitals/MedicalHistoryEntry rows, running each one through the actual
// rule engine (not just copying a label). Tolerant of the column-naming
// variations seen across different source files (see COLUMN_ALIASES).
//
// Usage:
//   npm run prisma:import                          # defaults to prisma/data/sample-patients.json
//   npm run prisma:import -- path/to/file.xlsx      # any .xlsx / .xls / .csv / .json
//
// Identity & duplicate handling:
//   Patient identity is scoped per source file ("batch"), not just by the
//   spreadsheet's own Patient ID column — different files may reuse the
//   same codes (e.g. "P001") for entirely different people. The default
//   batch (prisma/data/sample-patients.json) keeps its original plain
//   emails (p001@triage.local, ...) for backward compatibility; every
//   other batch gets its codes suffixed with a slug of the filename, so
//   two files reusing "P001" never collide or overwrite each other.
//   Within a single batch, re-importing the exact same row (by content
//   hash) is a no-op; a changed row for an already-imported patient in
//   that same batch updates the patient's demographics and adds a new
//   assessment (a new encounter).
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ruleEngineService } from "@/services/rule-engine.service";
import type { UrgencyLevel } from "@prisma/client";

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = "Patient123!";
const DEFAULT_BATCH_SLUG = "sample-patients";

type RawRow = Record<string, unknown>;

// Every field the importer understands, alongside the exact header
// strings seen across source files so far. Add a header here (don't
// rename existing ones) when a new file uses different wording.
const COLUMN_ALIASES: Record<string, string[]> = {
  patientId: ["Patient ID", "PatientId", "ID"],
  name: ["Name", "Patient Name"],
  age: ["Age"],
  gender: ["Gender", "Sex"],
  chiefComplaint: ["Chief Complaint"],
  symptoms: ["Symptoms"],
  duration: ["Duration"],
  medicalHistory: ["Medical History"],
  allergies: ["Allergies"],
  vitalsText: ["Vitals"],
  heartRate: ["Heart Rate", "HR"],
  bloodPressure: ["Blood Pressure", "BP"],
  temperature: ["Temperature (°C)", "Temperature (C)", "Temperature"],
  spo2: ["SpO2 (%)", "SpO2", "Oxygen Saturation"],
  expectedTriage: ["Expected Triage Level", "Expected Triage"],
};

function readColumn(row: RawRow, field: string): unknown {
  for (const header of COLUMN_ALIASES[field] ?? []) {
    if (row[header] !== undefined && row[header] !== null && row[header] !== "") return row[header];
  }
  return null;
}

// Dataset vocabulary has varied per file (Emergency/Urgent/Routine/
// Self-care vs. Emergency/Urgent/Less Urgent/Non-Urgent) — merged here
// rather than extending the UrgencyLevel enum, since every value maps
// cleanly onto the app's existing 4 levels.
const TRIAGE_MAP: Record<string, UrgencyLevel> = {
  emergency: "EMERGENCY",
  urgent: "URGENT",
  moderate: "MODERATE",
  "less urgent": "MODERATE",
  routine: "ROUTINE",
  "non-urgent": "ROUTINE",
  "non urgent": "ROUTINE",
  "self-care": "ROUTINE",
  "self care": "ROUTINE",
};

const RED_FLAG_KEYWORDS = [
  "chest pain", "chest tightness", "chest pressure", "sweating",
  "difficulty breathing", "shortness of breath", "wheezing", "breathless",
  "head injury", "slurred speech", "weakness", "unable to stand",
  "confusion", "bleeding", "blood sugar",
];

function isRedFlagText(text: string): boolean {
  const lower = text.toLowerCase();
  return RED_FLAG_KEYWORDS.some((kw) => lower.includes(kw));
}

function splitSymptoms(symptoms: string): string[] {
  return symptoms.split(",").map((s) => s.trim()).filter(Boolean);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") || parts[0]! };
}

type Warning = { field: string; message: string };

function parseDurationHours(raw: unknown): { hours: number; warning?: string } {
  const text = String(raw ?? "").trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(min|mins|hour|hours|day|days|week|weeks)/i);
  if (!match) return { hours: 0, warning: `Duration "${text}" not recognized — defaulted to 0 hours` };
  const value = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith("min")) return { hours: Math.round(value / 60) };
  if (unit.startsWith("hour")) return { hours: Math.round(value) };
  if (unit.startsWith("day")) return { hours: Math.round(value * 24) };
  return { hours: Math.round(value * 24 * 7) }; // week(s)
}

function parseIntInRange(raw: unknown, min: number, max: number, label: string): { value: number | null; warning?: string } {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (Number.isNaN(n)) return { value: null, warning: `${label} "${raw}" is not numeric — dropped` };
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return { value: null, warning: `${label} ${rounded} is out of plausible range [${min}-${max}] — dropped` };
  return { value: rounded };
}

function parseTemperature(raw: unknown): { value: number | null; warning?: string } {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (Number.isNaN(n)) return { value: null, warning: `Temperature "${raw}" is not numeric — dropped` };
  if (n < 25 || n > 45) return { value: null, warning: `Temperature ${n}°C is out of plausible range [25-45] — dropped` };
  return { value: Math.round(n * 10) / 10 };
}

function parseBloodPressure(raw: unknown): { systolic: number | null; diastolic: number | null; warning?: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { systolic: null, diastolic: null };
  const match = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { systolic: null, diastolic: null, warning: `Blood pressure "${text}" not recognized — dropped` };
  const systolic = parseInt(match[1]!, 10);
  const diastolic = parseInt(match[2]!, 10);
  if (systolic < 60 || systolic > 260 || diastolic < 30 || diastolic > 200) {
    return { systolic: null, diastolic: null, warning: `Blood pressure ${text} is out of plausible range — dropped` };
  }
  return { systolic, diastolic };
}

/** Fallback extraction for the older single free-text "Vitals" column
 * (e.g. "BP 170/100, HR 110", "Temp 101°F", "SpO₂ 90%"), used only
 * when the structured columns aren't present in this file. */
function parseVitalsText(text: string) {
  const bp = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  const hr = text.match(/HR\s*(\d{2,3})/i);
  const spo2 = text.match(/Sp[O0]\D?2?\s*(\d{1,3})\s*%/i);
  const tempF = text.match(/(\d{2,3}(?:\.\d+)?)\s*°?F/i);
  const tempC = text.match(/(\d{2,3}(?:\.\d+)?)\s*°?C/i);
  return {
    heartRate: hr ? parseInt(hr[1]!, 10) : null,
    systolic: bp ? parseInt(bp[1]!, 10) : null,
    diastolic: bp ? parseInt(bp[2]!, 10) : null,
    oxygenSaturation: spo2 ? parseInt(spo2[1]!, 10) : null,
    temperatureCelsius: tempC
      ? parseFloat(tempC[1]!)
      : tempF
        ? Math.round(((parseFloat(tempF[1]!) - 32) * (5 / 9)) * 10) / 10
        : null,
  };
}

type NormalizedRow = {
  patientId: string;
  name: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  symptoms: string[];
  durationHours: number;
  medicalHistory: string | null;
  allergies: string | null;
  heartRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  expectedTriage: UrgencyLevel;
  warnings: Warning[];
};

/** Returns null (and logs why) for rows missing something identity-critical
 * that can't be sensibly defaulted. Everything else is auto-fixed with a
 * logged warning rather than failing the whole row. */
function normalizeRow(raw: RawRow, rowNumber: number): NormalizedRow | null {
  const warnings: Warning[] = [];
  const errors: string[] = [];

  const patientId = String(readColumn(raw, "patientId") ?? "").trim();
  const name = String(readColumn(raw, "name") ?? "").trim();
  const chiefComplaint = String(readColumn(raw, "chiefComplaint") ?? "").trim();
  const symptomsRaw = String(readColumn(raw, "symptoms") ?? "").trim();
  const genderRaw = String(readColumn(raw, "gender") ?? "").trim();

  if (!patientId) errors.push("missing Patient ID");
  if (!name) errors.push("missing Name");
  if (!chiefComplaint) errors.push("missing Chief Complaint");
  if (!symptomsRaw) errors.push("missing Symptoms");
  if (!genderRaw) errors.push("missing Gender");

  const ageRaw = readColumn(raw, "age");
  const ageNum = typeof ageRaw === "number" ? ageRaw : parseFloat(String(ageRaw ?? ""));
  if (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120) errors.push(`Age "${ageRaw}" is missing or out of range [0-120]`);

  if (errors.length > 0) {
    console.warn(`Row ${rowNumber} (${patientId || "no ID"}): SKIPPED — ${errors.join("; ")}`);
    return null;
  }

  const duration = parseDurationHours(readColumn(raw, "duration"));
  if (duration.warning) warnings.push({ field: "duration", message: duration.warning });

  const vitalsTextRaw = readColumn(raw, "vitalsText");
  const vitalsFromText = typeof vitalsTextRaw === "string" ? parseVitalsText(vitalsTextRaw) : null;

  const heartRate = parseIntInRange(readColumn(raw, "heartRate") ?? vitalsFromText?.heartRate ?? null, 20, 250, "Heart rate");
  if (heartRate.warning) warnings.push({ field: "heartRate", message: heartRate.warning });

  const bp = readColumn(raw, "bloodPressure")
    ? parseBloodPressure(readColumn(raw, "bloodPressure"))
    : { systolic: vitalsFromText?.systolic ?? null, diastolic: vitalsFromText?.diastolic ?? null };
  if ("warning" in bp && bp.warning) warnings.push({ field: "bloodPressure", message: bp.warning });

  const temperature = parseTemperature(readColumn(raw, "temperature") ?? vitalsFromText?.temperatureCelsius ?? null);
  if (temperature.warning) warnings.push({ field: "temperature", message: temperature.warning });

  const spo2 = parseIntInRange(readColumn(raw, "spo2") ?? vitalsFromText?.oxygenSaturation ?? null, 0, 100, "SpO2");
  if (spo2.warning) warnings.push({ field: "spo2", message: spo2.warning });

  const expectedTriageRaw = String(readColumn(raw, "expectedTriage") ?? "").trim().toLowerCase();
  const expectedTriage = TRIAGE_MAP[expectedTriageRaw];
  if (!expectedTriage) {
    warnings.push({ field: "expectedTriage", message: `Expected triage "${expectedTriageRaw}" not recognized — defaulted to ROUTINE` });
  }

  for (const w of warnings) console.warn(`Row ${rowNumber} (${patientId}): auto-fixed — ${w.message}`);

  return {
    patientId,
    name,
    age: Math.round(ageNum),
    gender: genderRaw,
    chiefComplaint,
    symptoms: splitSymptoms(symptomsRaw),
    durationHours: duration.hours,
    medicalHistory: (() => {
      const v = String(readColumn(raw, "medicalHistory") ?? "").trim();
      return v && v.toLowerCase() !== "none" ? v : null;
    })(),
    allergies: (() => {
      const v = String(readColumn(raw, "allergies") ?? "").trim();
      return v && v.toLowerCase() !== "none" ? v : null;
    })(),
    heartRate: heartRate.value,
    bloodPressureSystolic: bp.systolic,
    bloodPressureDiastolic: bp.diastolic,
    temperatureCelsius: temperature.value,
    oxygenSaturation: spo2.value,
    expectedTriage: expectedTriage ?? "ROUTINE",
    warnings,
  };
}

function loadRawRows(filePath: string): RawRow[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

function batchSlugFor(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function emailFor(patientId: string, batchSlug: string): string {
  const code = patientId.toLowerCase();
  return batchSlug === DEFAULT_BATCH_SLUG ? `${code}@triage.local` : `${code}-${batchSlug}@triage.local`;
}

function rowContentHash(row: NormalizedRow): string {
  const canonical = JSON.stringify({
    name: row.name,
    age: row.age,
    gender: row.gender,
    chiefComplaint: row.chiefComplaint,
    symptoms: row.symptoms,
    durationHours: row.durationHours,
    medicalHistory: row.medicalHistory,
    allergies: row.allergies,
    heartRate: row.heartRate,
    bloodPressureSystolic: row.bloodPressureSystolic,
    bloodPressureDiastolic: row.bloodPressureDiastolic,
    temperatureCelsius: row.temperatureCelsius,
    oxygenSaturation: row.oxygenSaturation,
    expectedTriage: row.expectedTriage,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

const stats = { created: 0, updated: 0, skippedDuplicate: 0, skippedInvalid: 0 };

async function importRow(row: NormalizedRow, batchSlug: string, rowNumber: number) {
  const email = emailFor(row.patientId, batchSlug);
  const hash = rowContentHash(row);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { patientProfile: true },
  });

  let patientId: string;

  if (existingUser?.patientProfile) {
    const dup = await prisma.assessment.findFirst({
      where: { patientId: existingUser.patientProfile.id, intake: { path: ["sourceRowHash"], equals: hash } },
    });
    if (dup) {
      console.log(`Row ${rowNumber} (${row.patientId}): SKIPPED — identical row already imported`);
      stats.skippedDuplicate++;
      return;
    }

    const { firstName, lastName } = splitName(row.name);
    const birthYear = new Date().getFullYear() - row.age;
    await prisma.user.update({ where: { id: existingUser.id }, data: { firstName, lastName } });
    await prisma.patient.update({
      where: { id: existingUser.patientProfile.id },
      data: { dateOfBirth: new Date(Date.UTC(birthYear, 0, 1)), sex: row.gender },
    });
    patientId = existingUser.patientProfile.id;
    stats.updated++;
  } else {
    const { firstName, lastName } = splitName(row.name);
    const birthYear = new Date().getFullYear() - row.age;
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        authProviderId: `local:${email}`,
        email,
        passwordHash,
        role: "PATIENT",
        firstName,
        lastName,
        patientProfile: { create: { dateOfBirth: new Date(Date.UTC(birthYear, 0, 1)), sex: row.gender } },
      },
      include: { patientProfile: true },
    });
    patientId = user.patientProfile!.id;
    stats.created++;
  }

  if (row.medicalHistory || row.allergies) {
    const existingEntry = await prisma.medicalHistoryEntry.findFirst({ where: { patientId } });
    if (!existingEntry) {
      await prisma.medicalHistoryEntry.create({
        data: {
          patientId,
          condition: row.medicalHistory ?? "No prior conditions on record",
          medications: [],
          allergies: row.allergies ? [row.allergies] : [],
        },
      });
    }
  }

  const intake = {
    age: row.age,
    sex: row.gender,
    primarySymptom: row.chiefComplaint,
    durationHours: row.durationHours,
    ...(row.temperatureCelsius !== null && { temperatureCelsius: row.temperatureCelsius }),
    ...(row.heartRate !== null && { heartRate: row.heartRate }),
    ...(row.bloodPressureSystolic !== null && { bloodPressureSystolic: row.bloodPressureSystolic }),
    ...(row.bloodPressureDiastolic !== null && { bloodPressureDiastolic: row.bloodPressureDiastolic }),
    ...(row.oxygenSaturation !== null && { oxygenSaturation: row.oxygenSaturation }),
    additionalSymptoms: row.symptoms,
    medicalHistory: row.medicalHistory ? [row.medicalHistory] : [],
    currentMedications: [],
    lifestyleFactors: [],
    sourcePatientCode: row.patientId,
    sourceRowHash: hash,
  };

  const assessment = await prisma.assessment.create({
    data: { patientId, intake, status: "IN_PROGRESS" },
  });

  await prisma.vitals.create({
    data: {
      assessmentId: assessment.id,
      heartRate: row.heartRate,
      bloodPressureSystolic: row.bloodPressureSystolic,
      bloodPressureDiastolic: row.bloodPressureDiastolic,
      temperatureCelsius: row.temperatureCelsius,
      oxygenSaturation: row.oxygenSaturation,
    },
  });

  await prisma.symptom.createMany({
    data: row.symptoms.map((name) => ({
      assessmentId: assessment.id,
      name,
      durationHours: row.durationHours,
      isRedFlag: isRedFlagText(name),
    })),
  });

  const result = await ruleEngineService.evaluateAndApply(assessment.id);

  if (!result.shortCircuited) {
    await prisma.$transaction([
      prisma.assessment.update({
        where: { id: assessment.id },
        data: { urgencyLevel: row.expectedTriage, status: "AWAITING_REVIEW" },
      }),
      prisma.recommendation.create({
        data: {
          assessmentId: assessment.id,
          likelyConditions: [{ condition: row.chiefComplaint, confidenceWeight: 0.5 }],
          confidenceScore: 0.5,
          recommendedDept: row.expectedTriage === "EMERGENCY" ? "Emergency Department" : "General Medicine",
          nextSteps: ["Clinician review required — see source dataset for expected triage context."],
          riskFactors: row.medicalHistory ? [row.medicalHistory] : [],
          redFlagSymptoms: row.symptoms.filter(isRedFlagText),
          homeCareAdvice: row.expectedTriage === "ROUTINE" ? "Monitor symptoms; seek care if they worsen." : null,
          explanation:
            `No AI provider key was configured, or the deterministic rule engine found no match for ` +
            `patient ${row.patientId} — this urgency level was carried over from the source ` +
            `dataset's expected-triage column instead. Set an AI provider key and re-run an ` +
            `assessment to see an AI-generated recommendation instead.`,
          modelName: "sample-data-import",
        },
      }),
    ]);
  }

  console.log(`Row ${rowNumber} (${row.patientId}, ${row.name}): imported — ${row.expectedTriage}`);
}

async function main() {
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, "data", "sample-patients.json");

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const batchSlug = batchSlugFor(filePath);
  console.log(`Importing ${filePath} (batch: ${batchSlug})`);

  const rawRows = loadRawRows(filePath);
  console.log(`Parsed ${rawRows.length} raw rows`);

  for (let i = 0; i < rawRows.length; i++) {
    const row = normalizeRow(rawRows[i]!, i + 2); // +2: header row + 1-indexing
    if (!row) {
      stats.skippedInvalid++;
      continue;
    }
    await importRow(row, batchSlug, i + 2);
  }

  const totalPatients = await prisma.patient.count();
  const totalAssessments = await prisma.assessment.count();

  console.log("\n--- Import summary ---");
  console.log(`Rows in file:        ${rawRows.length}`);
  console.log(`Created (new):       ${stats.created}`);
  console.log(`Updated (existing):  ${stats.updated}`);
  console.log(`Skipped (duplicate): ${stats.skippedDuplicate}`);
  console.log(`Skipped (invalid):   ${stats.skippedInvalid}`);
  console.log(`Total patients in DB:    ${totalPatients}`);
  console.log(`Total assessments in DB: ${totalAssessments}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
