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

export interface AssessmentHealthSnapshot {
  id: string;
  snapshot: {
    profile: {
      conditions: { name: string; status: ConditionStatus }[];
      allergies: { substance: string; severity: string | null }[];
      medications: { name: string; dosage: string | null }[];
    } | null;
    healthMetrics: { label: string; value: number; unit: string; recordedAt: string; source: string }[];
  };
  createdAt: string;
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
  patient?: { id: string; user: { firstName: string; lastName: string } };
  healthSnapshot?: AssessmentHealthSnapshot | null;
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

export interface ExtendedAnalyticsSummary {
  newPatientsThisWeek: number;
  newPatientsThisMonth: number;
  activePatientCount: number;
  patientsRequiringReview: number;
  aiEscalationRate: number;
  clinicianOverrideCount: number;
  aiErrorCount: number;
  averageProcessingMinutes: number | null;
  commonConditions: { condition: string; count: number }[];
  abnormalVitalsCount: number;
  highRiskPatientCount: number;
  assessmentVolumeOverTime: { date: string; count: number }[];
}

export type ConditionStatus = "ACTIVE" | "RESOLVED";

export interface MedicalCondition {
  id: string;
  name: string;
  status: ConditionStatus;
  diagnosedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Allergy {
  id: string;
  substance: string;
  reaction: string | null;
  severity: "mild" | "moderate" | "severe" | null;
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  isActive: boolean;
  startedAt: string | null;
  createdAt: string;
}

export interface Surgery {
  id: string;
  procedure: string;
  performedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export type HealthProviderId = "DEMO" | "FITBIT" | "APPLE_HEALTH";
export type HealthConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface HealthProviderInfo {
  id: HealthProviderId;
  label: string;
  configured: boolean;
  requiresOAuth: boolean;
  unavailableReason: string | null;
}

export interface HealthConnection {
  id: string;
  provider: HealthProviderId;
  status: HealthConnectionStatus;
  scopes: string[];
  lastSyncedAt: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
}

export interface HealthMetricRecord {
  id: string;
  patientId: string;
  connectionId: string | null;
  source: HealthProviderId;
  metricType: string;
  value: number;
  unit: string;
  recordedAt: string;
  syncedAt: string;
  metadata: { synthetic?: boolean } | null;
}

export interface MedicalProfile {
  patient: {
    dateOfBirth: string;
    sex: string;
    bloodType: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
  conditions: MedicalCondition[];
  allergies: Allergy[];
  medications: Medication[];
  surgeries: Surgery[];
}

/** Response shape of GET /analytics/patients/:patientId — the admin/clinical
 * "everything about this patient in one place" aggregation. */
export interface PatientDetail {
  patient: {
    id: string;
    dateOfBirth: string;
    sex: string;
    bloodType: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    user: { firstName: string; lastName: string; email: string; phone: string | null };
    medicalConditions: MedicalCondition[];
    allergies: Allergy[];
    medications: Medication[];
    surgeries: Surgery[];
    healthConnections: HealthConnection[];
  };
  assessments: Assessment[];
  recentMetrics: HealthMetricRecord[];
  auditLogs: AuditLogEntry[];
}
