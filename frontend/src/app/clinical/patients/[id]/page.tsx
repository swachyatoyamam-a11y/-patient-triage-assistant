"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  RefreshCw, FileDown, HeartPulse, Thermometer, Gauge, Droplets,
  CheckSquare, Sparkles, ListTree, ShieldAlert, ChevronLeft,
  Pill, AlertTriangle, Stethoscope, PlugZap, History, SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UrgencyBadge, Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/shared/states";
import { useToast } from "@/components/shared/toast";
import { HealthTimeline } from "@/components/health/health-timeline";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Assessment, AssessmentStatus, PatientDetail, UrgencyLevel } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

type VitalState = "normal" | "warn" | "critical";

function vitalState(value: number | null | undefined, low: number, high: number, criticalLow?: number): VitalState {
  if (value === null || value === undefined) return "normal";
  if (criticalLow !== undefined && value < criticalLow) return "critical";
  if (value < low || value > high) return "warn";
  return "normal";
}

const VITAL_COLORS: Record<VitalState, string> = {
  normal: "text-slate-700 dark:text-slate-200",
  warn: "text-triage-moderate",
  critical: "text-triage-emergency",
};

function VitalTile({
  icon: Icon,
  label,
  value,
  unit,
  state,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: React.ReactNode;
  unit?: string;
  state: VitalState;
}) {
  return (
    <div className="rounded-xl border border-clinical-border p-3 dark:border-slate-800">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon size={13} />
        {label}
      </div>
      <p className={cn("mt-1 font-mono text-lg font-semibold", VITAL_COLORS[state])}>
        {value ?? "—"}
        {value !== null && value !== undefined && unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "danger"
          ? "bg-triage-emergency/10 text-triage-emergency"
          : "bg-clinical-gray text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {children}
    </span>
  );
}

function durationLabel(hours: unknown): string | null {
  if (typeof hours !== "number") return null;
  if (hours === 0) return "< 1 hour";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function AssessmentReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [assessment, setAssessment] = React.useState<Assessment | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [reanalyzing, setReanalyzing] = React.useState(false);
  const [patientDetail, setPatientDetail] = React.useState<PatientDetail | null>(null);
  const [overrideUrgency, setOverrideUrgency] = React.useState<UrgencyLevel | "">("");
  const [overriding, setOverriding] = React.useState(false);

  const load = React.useCallback(() => {
    setError(null);
    apiFetch<{ assessment: Assessment }>(`/assessments/${params.id}`)
      .then((res) => {
        setAssessment(res.assessment);
        setNotes(res.assessment.clinicianNotes ?? "");
        const patientId = res.assessment.patient?.id;
        if (patientId) {
          apiFetch<PatientDetail>(`/analytics/patients/${patientId}`)
            .then(setPatientDetail)
            .catch(() => {
              // Non-critical — the core assessment view still works without
              // the extended patient-history sections.
            });
        }
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load this assessment."));
  }, [params.id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function overrideUrgencyLevel() {
    if (!overrideUrgency) return;
    setOverriding(true);
    try {
      await apiFetch(`/assessments/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ urgencyLevel: overrideUrgency }),
      });
      toast.success(`Urgency overridden to ${overrideUrgency}.`);
      setOverrideUrgency("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't override urgency.");
    } finally {
      setOverriding(false);
    }
  }

  async function updateStatus(status: AssessmentStatus) {
    setSaving(true);
    try {
      await apiFetch(`/assessments/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, clinicianNotes: notes }),
      });
      toast.success(`Marked ${status.toLowerCase()}.`);
      load();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Couldn't save changes.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function reanalyze() {
    setReanalyzing(true);
    try {
      await apiFetch(`/assessments/${params.id}/reanalyze`, { method: "POST" });
      toast.success("Re-analysis complete.");
      load();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Re-analysis failed.";
      setError(message);
      toast.error(message);
    } finally {
      setReanalyzing(false);
    }
  }

  if (error && !assessment) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const rec = assessment.recommendation;
  const intake = assessment.intake;
  const patientName = assessment.patient ? `${assessment.patient.user.firstName} ${assessment.patient.user.lastName}` : "Patient";
  const age = typeof intake.age === "number" ? intake.age : null;
  const sex = typeof intake.sex === "string" ? intake.sex : null;
  const duration = durationLabel(intake.durationHours);
  const additionalTags: string[] = Array.isArray(intake.additionalSymptoms)
    ? (intake.additionalSymptoms as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const medicalHistory: string[] = Array.isArray(intake.medicalHistory)
    ? (intake.medicalHistory as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const medications: string[] = Array.isArray(intake.currentMedications)
    ? (intake.currentMedications as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const sourceCode = typeof intake.sourcePatientCode === "string" ? intake.sourcePatientCode : null;

  const v = assessment.vitals;
  const hasVitals =
    v && (v.heartRate !== null || v.bloodPressureSystolic !== null || v.temperatureCelsius !== null || v.oxygenSaturation !== null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/clinical/dashboard")}
            className="flex items-center gap-1 text-sm text-clinical-blue hover:underline"
          >
            <ChevronLeft size={15} />
            Back to queue
          </button>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{patientName}</h1>
            {(age || sex) && (
              <span className="font-mono text-sm text-slate-400">
                {age ?? "—"}
                {sex ? ` · ${sex}` : ""}
              </span>
            )}
          </div>
          {sourceCode && <p className="mt-0.5 text-xs text-slate-400">Source record: {sourceCode}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {assessment.urgencyLevel && <UrgencyBadge level={assessment.urgencyLevel} />}
          <Badge>{assessment.status.replace("_", " ").toLowerCase()}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Reported symptoms</CardTitle>
              {duration && <CardDescription>Onset: {duration} ago</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {typeof intake.primarySymptom === "string" ? intake.primarySymptom : "—"}
              </p>

              {assessment.symptoms && assessment.symptoms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assessment.symptoms.map((s) => (
                    <Tag key={s.id} tone={s.isRedFlag ? "danger" : undefined}>
                      {s.isRedFlag && <ShieldAlert size={11} className="mr-1" />}
                      {s.name}
                    </Tag>
                  ))}
                </div>
              ) : additionalTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {additionalTags.map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
              ) : null}

              {(medicalHistory.length > 0 || medications.length > 0) && (
                <div className="grid gap-4 border-t border-clinical-border pt-4 sm:grid-cols-2 dark:border-slate-800">
                  {medicalHistory.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Medical history</p>
                      <div className="flex flex-wrap gap-1.5">
                        {medicalHistory.map((m) => (
                          <Tag key={m}>{m}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {medications.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Current medications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {medications.map((m) => (
                          <Tag key={m}>{m}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {assessment.ruleTriggers && assessment.ruleTriggers.length > 0 && (
            <Card className="border-clinical-blue/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListTree size={16} className="text-clinical-blue" />
                  <CardTitle>Deterministic rule matches</CardTitle>
                </div>
                <CardDescription>Caught before any AI ran — no model in the loop for these.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {assessment.ruleTriggers.map((rt) => (
                  <div
                    key={rt.id}
                    className="flex items-center justify-between rounded-xl bg-clinical-gray/60 px-4 py-2.5 dark:bg-slate-800/60"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{rt.rule.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{rt.rule.description}</p>
                    </div>
                    <UrgencyBadge level={rt.rule.resultingUrgency} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-clinical-blue" />
                  <CardTitle>AI-assisted recommendation</CardTitle>
                </div>
                <button
                  onClick={reanalyze}
                  disabled={reanalyzing}
                  className="flex items-center gap-1.5 text-xs font-medium text-clinical-blue hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={reanalyzing ? "animate-spin" : ""} />
                  Re-analyze
                </button>
              </div>
              <CardDescription>Not a diagnosis — review before acting.</CardDescription>
            </CardHeader>
            <CardContent>
              {!rec ? (
                <p className="text-sm text-slate-400">No recommendation yet.</p>
              ) : (
                <div className="space-y-5 text-sm">
                  {rec.likelyConditions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Possible conditions to consider</p>
                      <div className="space-y-2">
                        {rec.likelyConditions.map((c) => (
                          <div key={c.condition}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700 dark:text-slate-200">{c.condition}</span>
                              <span className="font-mono text-slate-400">{Math.round(c.confidenceWeight * 100)}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-clinical-gray dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-clinical-blue"
                                style={{ width: `${Math.round(c.confidenceWeight * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Recommended department: </span>
                    {rec.recommendedDept}
                  </div>

                  {rec.nextSteps.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Next steps</p>
                      <ul className="space-y-1.5">
                        {rec.nextSteps.map((step) => (
                          <li key={step} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                            <CheckSquare size={14} className="mt-0.5 shrink-0 text-clinical-blue" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rec.redFlagSymptoms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Red flags</span>
                      {rec.redFlagSymptoms.map((s) => (
                        <Tag key={s} tone="danger">{s}</Tag>
                      ))}
                    </div>
                  )}

                  {rec.riskFactors.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Risk factors</span>
                      {rec.riskFactors.map((s) => (
                        <Tag key={s}>{s}</Tag>
                      ))}
                    </div>
                  )}

                  {rec.homeCareAdvice && (
                    <p className="rounded-xl bg-triage-routine/5 px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="font-medium text-triage-routine">Home care: </span>
                      {rec.homeCareAdvice}
                    </p>
                  )}

                  <p className="leading-relaxed text-slate-600 dark:text-slate-300">{rec.explanation}</p>
                  <p className="font-mono text-xs text-slate-400">Source: {rec.modelName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clinician notes &amp; disposition</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add your notes before marking reviewed…"
                className="w-full rounded-xl border border-clinical-border bg-white px-4 py-3 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => updateStatus("REVIEWED")} disabled={saving}>
                  Mark reviewed
                </Button>
                <Button size="sm" variant="secondary" onClick={() => updateStatus("RESOLVED")} disabled={saving}>
                  Mark resolved
                </Button>
                <a
                  href={`${API_BASE_URL}/reports/${assessment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-clinical-border px-4 py-2 text-sm font-medium text-clinical-blueDark hover:bg-clinical-gray dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                >
                  <FileDown size={14} />
                  Download report
                </a>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-clinical-border pt-4 dark:border-slate-800">
                <SlidersHorizontal size={14} className="shrink-0 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Override urgency:</span>
                <select
                  value={overrideUrgency}
                  onChange={(e) => setOverrideUrgency(e.target.value as UrgencyLevel | "")}
                  className="rounded-lg border border-clinical-border bg-white px-2 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="">Select level…</option>
                  {(["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"] as UrgencyLevel[]).map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!overrideUrgency || overrideUrgency === assessment.urgencyLevel || overriding}
                  onClick={overrideUrgencyLevel}
                >
                  Apply override
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Stethoscope size={16} className="text-clinical-blue" />
                    <CardTitle className="text-base">Medical history</CardTitle>
                  </div>
                  <CardDescription>From the patient's stored profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!patientDetail ? (
                    <Skeleton className="h-16 w-full" />
                  ) : patientDetail.patient.medicalConditions.length === 0 ? (
                    <p className="text-sm text-slate-400">No conditions on file.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {patientDetail.patient.medicalConditions.map((c) => (
                        <Tag key={c.id}>
                          {c.name}
                          {c.status === "RESOLVED" && " (resolved)"}
                        </Tag>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-triage-emergency" />
                    <CardTitle className="text-base">Allergies</CardTitle>
                  </div>
                  <CardDescription>From the patient's stored profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!patientDetail ? (
                    <Skeleton className="h-16 w-full" />
                  ) : patientDetail.patient.allergies.length === 0 ? (
                    <p className="text-sm text-slate-400">No allergies on file.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {patientDetail.patient.allergies.map((a) => (
                        <Tag key={a.id} tone="danger">
                          {a.substance}
                          {a.severity && ` (${a.severity})`}
                        </Tag>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Pill size={16} className="text-clinical-blue" />
                    <CardTitle className="text-base">Medications</CardTitle>
                  </div>
                  <CardDescription>From the patient's stored profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!patientDetail ? (
                    <Skeleton className="h-16 w-full" />
                  ) : patientDetail.patient.medications.filter((m) => m.isActive).length === 0 ? (
                    <p className="text-sm text-slate-400">No active medications on file.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {patientDetail.patient.medications
                        .filter((m) => m.isActive)
                        .map((m) => (
                          <Tag key={m.id}>
                            {m.name}
                            {m.dosage && ` — ${m.dosage}`}
                          </Tag>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PlugZap size={16} className="text-clinical-blue" />
                    <CardTitle className="text-base">Connected health sources</CardTitle>
                  </div>
                  <CardDescription>Wearable/device connections on file.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!patientDetail ? (
                    <Skeleton className="h-16 w-full" />
                  ) : patientDetail.patient.healthConnections.length === 0 ? (
                    <p className="text-sm text-slate-400">No health data sources connected.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {patientDetail.patient.healthConnections.map((c) => (
                        <li key={c.id} className="flex items-center justify-between">
                          <span className="text-slate-700 dark:text-slate-200">{c.provider}</span>
                          <Badge>{c.status.toLowerCase()}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
          </div>

          {patientDetail && patientDetail.recentMetrics.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                <HeartPulse size={16} className="text-clinical-blue" />
                Health data timeline
              </h3>
              <HealthTimeline metrics={patientDetail.recentMetrics} loading={false} />
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                <CardTitle className="text-base">Audit history</CardTitle>
              </div>
              <CardDescription>Every recorded action tied to this patient.</CardDescription>
            </CardHeader>
            <CardContent>
              {!patientDetail ? (
                <Skeleton className="h-24 w-full" />
              ) : patientDetail.auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400">No audit entries yet.</p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {patientDetail.auditLogs.map((log) => (
                    <li key={log.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700 dark:text-slate-200">{log.action.replace(/_/g, " ").toLowerCase()}</p>
                        {log.user && <p className="text-xs text-slate-400">{log.user.email} · {log.user.role}</p>}
                      </div>
                      <span className="shrink-0 font-mono text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {hasVitals && (
            <Card>
              <CardHeader>
                <CardTitle>Vitals</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <VitalTile
                  icon={HeartPulse}
                  label="Heart rate"
                  value={v?.heartRate}
                  unit="bpm"
                  state={vitalState(v?.heartRate, 60, 100)}
                />
                <VitalTile
                  icon={Gauge}
                  label="Blood pressure"
                  value={v?.bloodPressureSystolic && v?.bloodPressureDiastolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : null}
                  state={vitalState(v?.bloodPressureSystolic, 90, 140)}
                />
                <VitalTile
                  icon={Thermometer}
                  label="Temperature"
                  value={v?.temperatureCelsius}
                  unit="°C"
                  state={vitalState(v?.temperatureCelsius, 36.1, 37.8)}
                />
                <VitalTile
                  icon={Droplets}
                  label="SpO2"
                  value={v?.oxygenSaturation}
                  unit="%"
                  state={vitalState(v?.oxygenSaturation, 95, 100, 90)}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Submitted</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                  {new Date(assessment.createdAt).toLocaleString()}
                </span>
              </div>
              {assessment.reviewedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Reviewed</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                    {new Date(assessment.reviewedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
