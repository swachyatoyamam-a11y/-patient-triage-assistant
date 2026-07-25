export type UrgencyLevel = "EMERGENCY" | "URGENT" | "MODERATE" | "ROUTINE";
export type AssessmentStatus = "IN_PROGRESS" | "AWAITING_REVIEW" | "REVIEWED" | "RESOLVED" | "CANCELLED";

export interface Recommendation {
  id: string;
  likelyConditions: { condition: string; confidenceWeight: number }[];
  confidenceScore: number;
  recommendedDept: string;
  nextSteps: string[];
  riskFactors: string[];
  redFlagSymptoms: string[];
  homeCareAdvice: string | null;
  explanation: string;
  modelName: string;
  createdAt: string;
}

export interface Vitals {
  id: string;
  heartRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
}

export interface Symptom {
  id: string;
  name: string;
  severity: number | null;
  durationHours: number | null;
  notes: string | null;
  isRedFlag: boolean;
}

export interface RuleTrigger {
  id: string;
  triggeredAt: string;
  rule: { id: string; name: string; description: string; resultingUrgency: UrgencyLevel };
}

export interface Assessment {
  id: string;
  patientId: string;
  status: AssessmentStatus;
  urgencyLevel: UrgencyLevel | null;
  intake: Record<string, unknown>;
  clinicianNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  recommendation?: Recommendation | null;
  vitals?: Vitals | null;
  symptoms?: Symptom[];
  ruleTriggers?: RuleTrigger[];
  patient?: { user: { firstName: string; lastName: string } };
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  condition: { allOf?: string[]; anyOf?: string[]; noneOf?: string[]; ageUnder?: number; ageOver?: number };
  resultingUrgency: UrgencyLevel;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: { email: string; role: string } | null;
}

export interface AnalyticsSummary {
  patientsToday: number;
  emergencyCases: number;
  urgencyBreakdown: { urgencyLevel: UrgencyLevel | null; _count: number }[];
  averageWaitMinutes: number | null;
}

export interface SymptomFrequency {
  symptom: string;
  count: number;
}
