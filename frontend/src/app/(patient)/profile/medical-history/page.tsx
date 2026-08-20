"use client";

import * as React from "react";
import { Plus, X, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/shared/states";
import { useToast } from "@/components/shared/toast";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { MedicalProfile, ConditionStatus } from "@/types/api";

const COMMON_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Heart disease",
  "Thyroid disorders",
  "Kidney disease",
  "Liver disease",
  "High cholesterol",
  "Previous stroke",
];

const inputClass =
  "w-full rounded-xl border border-clinical-border bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white";
const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300";

/**
 * Structured, persistent medical profile — read automatically by the
 * assessment pipeline (backend/src/services/patient-context.service.ts)
 * instead of being re-typed on every visit. Every mutation here hits its
 * own scoped endpoint (see backend/src/routes/patient.routes.ts) rather
 * than a single "save everything" button, so changes persist immediately
 * and the patient never loses partial edits to an unrelated section.
 */
export default function MedicalHistoryPage() {
  const toast = useToast();
  const [profile, setProfile] = React.useState<MedicalProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<MedicalProfile>("/patients/me/medical-profile");
      setProfile(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't load your medical profile.");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const activeConditionNames = new Set(
    profile.conditions.filter((c) => c.status === "ACTIVE").map((c) => c.name.toLowerCase())
  );

  async function toggleCommonCondition(name: string) {
    const existing = profile!.conditions.find((c) => c.name.toLowerCase() === name.toLowerCase());
    await withBusy(async () => {
      if (existing) {
        await apiFetch(`/patients/me/conditions/${existing.id}`, { method: "DELETE" });
      } else {
        await apiFetch("/patients/me/conditions", { method: "POST", body: JSON.stringify({ name }) });
      }
      await load();
    });
  }

  async function toggleConditionStatus(id: string, status: ConditionStatus) {
    await withBusy(async () => {
      await apiFetch(`/patients/me/conditions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: status === "ACTIVE" ? "RESOLVED" : "ACTIVE" }),
      });
      await load();
    });
  }

  async function removeCondition(id: string) {
    await withBusy(async () => {
      await apiFetch(`/patients/me/conditions/${id}`, { method: "DELETE" });
      await load();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
          <HeartPulse className="text-clinical-blue" size={24} />
          Medical History &amp; Existing Conditions
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Stored once here — future assessments use this automatically, so you won&apos;t need to re-enter it
          every visit. You can edit or remove anything at any time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing conditions</CardTitle>
          <CardDescription>Select any that apply, or add a custom condition below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {COMMON_CONDITIONS.map((name) => {
              const checked = activeConditionNames.has(name.toLowerCase());
              return (
                <button
                  key={name}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleCommonCondition(name)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                    checked
                      ? "border-clinical-blue bg-clinical-blue text-white"
                      : "border-clinical-border text-slate-600 hover:bg-clinical-gray dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <CustomConditionForm
            busy={busy}
            onAdd={(name) =>
              withBusy(async () => {
                await apiFetch("/patients/me/conditions", { method: "POST", body: JSON.stringify({ name }) });
                await load();
              })
            }
          />

          {profile.conditions.length > 0 && (
            <ul className="mt-2 space-y-2 border-t border-clinical-border pt-4 dark:border-slate-800">
              {profile.conditions.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-clinical-border px-3 py-2 dark:border-slate-800"
                >
                  <span className="text-sm text-slate-800 dark:text-slate-100">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleConditionStatus(c.id, c.status)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        c.status === "ACTIVE"
                          ? "bg-triage-urgent/10 text-triage-urgent"
                          : "bg-triage-routine/10 text-triage-routine"
                      )}
                    >
                      {c.status === "ACTIVE" ? "Active" : "Resolved"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeCondition(c.id)}
                      aria-label={`Remove ${c.name}`}
                      className="text-slate-400 hover:text-triage-emergency"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AllergiesCard profile={profile} busy={busy} withBusy={withBusy} reload={load} />
      <MedicationsCard profile={profile} busy={busy} withBusy={withBusy} reload={load} />
      <SurgeriesCard profile={profile} busy={busy} withBusy={withBusy} reload={load} />
      <EmergencyInfoCard profile={profile} busy={busy} withBusy={withBusy} reload={load} />
    </div>
  );
}

function CustomConditionForm({ busy, onAdd }: { busy: boolean; onAdd: (name: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue("");
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Other / custom condition"
        className={inputClass}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={busy || !value.trim()}>
        <Plus size={16} />
        Add
      </Button>
    </form>
  );
}

type SectionProps = {
  profile: MedicalProfile;
  busy: boolean;
  withBusy: (fn: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
};

function AllergiesCard({ profile, busy, withBusy, reload }: SectionProps) {
  const [substance, setSubstance] = React.useState("");
  const [reaction, setReaction] = React.useState("");
  const [severity, setSeverity] = React.useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!substance.trim()) return;
    withBusy(async () => {
      await apiFetch("/patients/me/allergies", {
        method: "POST",
        body: JSON.stringify({ substance: substance.trim(), reaction: reaction || undefined, severity: severity || undefined }),
      });
      setSubstance("");
      setReaction("");
      setSeverity("");
      await reload();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allergies</CardTitle>
        <CardDescription>Medications, foods, or other substances you react to.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]">
          <input value={substance} onChange={(e) => setSubstance(e.target.value)} placeholder="Substance (e.g. Penicillin)" className={inputClass} />
          <input value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="Reaction (optional)" className={inputClass} />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
            <option value="">Severity</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
          <Button type="submit" variant="secondary" size="sm" disabled={busy || !substance.trim()}>
            <Plus size={16} />
          </Button>
        </form>

        {profile.allergies.length > 0 && (
          <ul className="space-y-2 border-t border-clinical-border pt-4 dark:border-slate-800">
            {profile.allergies.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-clinical-border px-3 py-2 dark:border-slate-800">
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {a.substance}
                  {a.reaction && <span className="text-slate-500 dark:text-slate-400"> — {a.reaction}</span>}
                  {a.severity && (
                    <span className="ml-2 rounded-full bg-triage-emergency/10 px-2 py-0.5 text-xs font-medium text-triage-emergency">
                      {a.severity}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => withBusy(async () => { await apiFetch(`/patients/me/allergies/${a.id}`, { method: "DELETE" }); await reload(); })}
                  aria-label={`Remove ${a.substance}`}
                  className="text-slate-400 hover:text-triage-emergency"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MedicationsCard({ profile, busy, withBusy, reload }: SectionProps) {
  const [name, setName] = React.useState("");
  const [dosage, setDosage] = React.useState("");
  const [frequency, setFrequency] = React.useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    withBusy(async () => {
      await apiFetch("/patients/me/medications", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), dosage: dosage || undefined, frequency: frequency || undefined }),
      });
      setName("");
      setDosage("");
      setFrequency("");
      await reload();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current medications</CardTitle>
        <CardDescription>What you&apos;re currently taking, including dosage if you know it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Medication name" className={inputClass} />
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage" className={inputClass} />
          <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Frequency" className={inputClass} />
          <Button type="submit" variant="secondary" size="sm" disabled={busy || !name.trim()}>
            <Plus size={16} />
          </Button>
        </form>

        {profile.medications.length > 0 && (
          <ul className="space-y-2 border-t border-clinical-border pt-4 dark:border-slate-800">
            {profile.medications.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl border border-clinical-border px-3 py-2 dark:border-slate-800">
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {m.name}
                  {(m.dosage || m.frequency) && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      — {[m.dosage, m.frequency].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {!m.isActive && (
                    <span className="ml-2 rounded-full bg-clinical-gray px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      discontinued
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => withBusy(async () => { await apiFetch(`/patients/me/medications/${m.id}`, { method: "DELETE" }); await reload(); })}
                  aria-label={`Remove ${m.name}`}
                  className="text-slate-400 hover:text-triage-emergency"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SurgeriesCard({ profile, busy, withBusy, reload }: SectionProps) {
  const [procedure, setProcedure] = React.useState("");
  const [performedAt, setPerformedAt] = React.useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!procedure.trim()) return;
    withBusy(async () => {
      await apiFetch("/patients/me/surgeries", {
        method: "POST",
        body: JSON.stringify({ procedure: procedure.trim(), performedAt: performedAt || undefined }),
      });
      setProcedure("");
      setPerformedAt("");
      await reload();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous major surgeries</CardTitle>
        <CardDescription>Optional — add any prior procedures relevant to your care.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Procedure" className={inputClass} />
          <input type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className={inputClass} />
          <Button type="submit" variant="secondary" size="sm" disabled={busy || !procedure.trim()}>
            <Plus size={16} />
          </Button>
        </form>

        {profile.surgeries.length > 0 && (
          <ul className="space-y-2 border-t border-clinical-border pt-4 dark:border-slate-800">
            {profile.surgeries.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl border border-clinical-border px-3 py-2 dark:border-slate-800">
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {s.procedure}
                  {s.performedAt && (
                    <span className="text-slate-500 dark:text-slate-400"> — {new Date(s.performedAt).toLocaleDateString()}</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => withBusy(async () => { await apiFetch(`/patients/me/surgeries/${s.id}`, { method: "DELETE" }); await reload(); })}
                  aria-label={`Remove ${s.procedure}`}
                  className="text-slate-400 hover:text-triage-emergency"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmergencyInfoCard({ profile, busy, withBusy, reload }: SectionProps) {
  const [bloodType, setBloodType] = React.useState(profile.patient.bloodType ?? "");
  const [contactName, setContactName] = React.useState(profile.patient.emergencyContactName ?? "");
  const [contactPhone, setContactPhone] = React.useState(profile.patient.emergencyContactPhone ?? "");
  const toast = useToast();

  function save(e: React.FormEvent) {
    e.preventDefault();
    withBusy(async () => {
      await apiFetch("/patients/me/emergency-info", {
        method: "PATCH",
        body: JSON.stringify({
          bloodType: bloodType || undefined,
          emergencyContactName: contactName || undefined,
          emergencyContactPhone: contactPhone || undefined,
        }),
      });
      toast.success("Emergency information saved.");
      await reload();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency information</CardTitle>
        <CardDescription>Available to your care team if you&apos;re ever treated in an emergency.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Blood type</label>
            <input value={bloodType} onChange={(e) => setBloodType(e.target.value)} placeholder="e.g. O+" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Emergency contact name</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Emergency contact phone</label>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
