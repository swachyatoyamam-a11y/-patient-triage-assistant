"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrgencyBadge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Assessment, MedicalProfile } from "@/types/api";

type TemperatureUnit = "C" | "F";

type IntakeState = {
  age: string;
  sex: string;
  primarySymptom: string;
  painLevel: string;
  durationHours: string;
  temperatureValue: string;
  temperatureUnit: TemperatureUnit;
  heartRate: string;
  oxygenSaturation: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  additionalSymptoms: string;
  medicalHistory: string;
  currentMedications: string;
  isPregnant: boolean | null;
  lifestyleFactors: string;
};

const INITIAL_STATE: IntakeState = {
  age: "",
  sex: "",
  primarySymptom: "",
  painLevel: "",
  durationHours: "",
  temperatureValue: "",
  temperatureUnit: "C",
  heartRate: "",
  oxygenSaturation: "",
  bloodPressureSystolic: "",
  bloodPressureDiastolic: "",
  additionalSymptoms: "",
  medicalHistory: "",
  currentMedications: "",
  isPregnant: null,
  lifestyleFactors: "",
};

type Step = {
  key: keyof IntakeState;
  question: string;
  helper?: string;
  /** Shows a red asterisk next to the question and (via isValid) blocks
   * advancing until answered. Omit for genuinely optional steps. */
  required?: boolean;
  render: (
    value: unknown,
    set: (v: unknown) => void,
    state: IntakeState,
    setState: React.Dispatch<React.SetStateAction<IntakeState>>
  ) => React.ReactNode;
  isValid: (state: IntakeState) => boolean;
  /** Skip this step entirely based on prior answers (e.g. pregnancy only if relevant). */
  skip?: (state: IntakeState) => boolean;
};

function TextField({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      autoFocus
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-clinical-border bg-white px-4 py-3 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
  );
}

function ChoiceField({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            value === opt
              ? "border-clinical-blue bg-clinical-blue text-white"
              : "border-clinical-border text-slate-600 hover:bg-clinical-gray dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// --- Numeric input helpers -------------------------------------------------
// Filters keystrokes at entry time (rather than validating after the fact)
// so letters/symbols simply never make it into the field, per the "numeric
// only, decimals allowed to one place" requirement.

function isValidDecimalInput(value: string): boolean {
  return value === "" || /^\d{0,3}(\.\d?)?$/.test(value);
}

function isValidIntegerInput(value: string): boolean {
  return value === "" || /^\d{0,3}$/.test(value);
}

function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

const TEMPERATURE_RANGES: Record<TemperatureUnit, { min: number; max: number; message: string }> = {
  C: { min: 30, max: 45, message: "Please enter a valid human body temperature between 30°C and 45°C." },
  F: { min: 86, max: 113, message: "Please enter a valid human body temperature between 86°F and 113°F." },
};

function getTemperatureError(state: IntakeState): string | null {
  if (state.temperatureValue.trim() === "") return null;
  const value = Number(state.temperatureValue);
  if (Number.isNaN(value)) return null;
  const range = TEMPERATURE_RANGES[state.temperatureUnit];
  if (value < range.min || value > range.max) return range.message;
  return null;
}

function getHeartRateError(state: IntakeState): string | null {
  if (state.heartRate.trim() === "") return null;
  const value = Number(state.heartRate);
  if (Number.isNaN(value) || value < 20 || value > 250) {
    return "Please enter a valid pulse rate between 20 and 250 bpm.";
  }
  return null;
}

function getOxygenSaturationError(state: IntakeState): string | null {
  if (state.oxygenSaturation.trim() === "") return null;
  const value = Number(state.oxygenSaturation);
  if (Number.isNaN(value) || value < 50 || value > 100) {
    return "Please enter a valid SpO2 between 50% and 100%.";
  }
  return null;
}

function getSystolicError(state: IntakeState): string | null {
  if (state.bloodPressureSystolic.trim() === "") return null;
  const value = Number(state.bloodPressureSystolic);
  if (Number.isNaN(value) || value < 50 || value > 250) {
    return "Please enter a valid systolic pressure between 50 and 250 mmHg.";
  }
  return null;
}

function getDiastolicError(state: IntakeState): string | null {
  if (state.bloodPressureDiastolic.trim() === "") return null;
  const value = Number(state.bloodPressureDiastolic);
  if (Number.isNaN(value) || value < 30 || value > 150) {
    return "Please enter a valid diastolic pressure between 30 and 150 mmHg.";
  }
  const systolic = Number(state.bloodPressureSystolic);
  if (state.bloodPressureSystolic.trim() !== "" && !Number.isNaN(systolic) && systolic <= value) {
    return "Systolic pressure must be greater than diastolic pressure.";
  }
  return null;
}

function numericFieldClass(error: string | null) {
  return cn(
    "w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 dark:bg-slate-800 dark:text-white",
    error
      ? "border-triage-emergency focus-visible:ring-triage-emergency"
      : "border-clinical-border focus-visible:ring-clinical-blue dark:border-slate-700"
  );
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-triage-emergency">
      {message}
    </p>
  );
}

function NumericField({
  value,
  onChange,
  placeholder,
  error,
  allowDecimal = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error: string | null;
  allowDecimal?: boolean;
}) {
  const isValidInput = allowDecimal ? isValidDecimalInput : isValidIntegerInput;
  return (
    <div>
      <input
        autoFocus
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => {
          if (isValidInput(e.target.value)) onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={numericFieldClass(error)}
      />
      <InlineError message={error} />
    </div>
  );
}

function TemperatureField({
  state,
  setState,
}: {
  state: IntakeState;
  setState: React.Dispatch<React.SetStateAction<IntakeState>>;
}) {
  const error = getTemperatureError(state);

  function handleUnitChange(nextUnit: TemperatureUnit) {
    if (nextUnit === state.temperatureUnit) return;
    const numeric = Number(state.temperatureValue);
    const converted =
      state.temperatureValue.trim() === "" || Number.isNaN(numeric)
        ? ""
        : String(roundToOneDecimal(nextUnit === "F" ? celsiusToFahrenheit(numeric) : fahrenheitToCelsius(numeric)));
    setState((prev) => ({ ...prev, temperatureUnit: nextUnit, temperatureValue: converted }));
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={state.temperatureValue}
          onChange={(e) => {
            if (isValidDecimalInput(e.target.value)) {
              setState((prev) => ({ ...prev, temperatureValue: e.target.value }));
            }
          }}
          placeholder={state.temperatureUnit === "C" ? "e.g. 37.0" : "e.g. 98.6"}
          className={numericFieldClass(error)}
        />
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-clinical-border dark:border-slate-700">
          {(["C", "F"] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => handleUnitChange(unit)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                state.temperatureUnit === unit
                  ? "bg-clinical-blue text-white"
                  : "bg-white text-slate-600 hover:bg-clinical-gray dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              °{unit}
            </button>
          ))}
        </div>
      </div>
      <InlineError message={error} />
    </div>
  );
}

const STEPS: Step[] = [
  {
    key: "age",
    question: "What is your age?",
    required: true,
    render: (v, set) => <TextField type="number" value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 34" />,
    isValid: (s) => s.age.trim() !== "" && Number(s.age) >= 0 && Number(s.age) <= 120,
  },
  {
    key: "sex",
    question: "What is your sex?",
    helper: "Used to interpret certain symptoms correctly — not shared beyond your care team.",
    required: true,
    render: (v, set) => <ChoiceField options={["Female", "Male", "Other"]} value={v as string} onChange={set as (v: string) => void} />,
    isValid: (s) => s.sex.trim() !== "",
  },
  {
    key: "primarySymptom",
    question: "What's the main symptom bringing you in today?",
    required: true,
    render: (v, set) => (
      <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. chest pain, sore throat, head injury" />
    ),
    isValid: (s) => s.primarySymptom.trim().length > 0,
  },
  {
    key: "painLevel",
    question: "On a scale of 0–10, how severe is it?",
    helper: "0 is no pain at all, 10 is the worst pain you can imagine.",
    required: true,
    render: (v, set) => (
      <ChoiceField options={Array.from({ length: 11 }, (_, i) => String(i))} value={v as string} onChange={set as (v: string) => void} />
    ),
    isValid: (s) => s.painLevel !== "",
  },
  {
    key: "durationHours",
    question: "About how many hours have you had this symptom?",
    required: true,
    render: (v, set) => <TextField type="number" value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 6" />,
    isValid: (s) => s.durationHours.trim() !== "",
  },
  {
    key: "temperatureValue",
    question: "What's your temperature?",
    helper: "Switch units any time — your entry converts automatically.",
    required: true,
    render: (_v, _set, state, setState) => <TemperatureField state={state} setState={setState} />,
    isValid: (s) => s.temperatureValue.trim() !== "" && getTemperatureError(s) === null,
  },
  {
    key: "heartRate",
    question: "What's your pulse rate?",
    helper: "In beats per minute (bpm). Leave blank if you haven't checked it.",
    render: (v, set, state) => (
      <NumericField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 78" error={getHeartRateError(state)} />
    ),
    isValid: (s) => getHeartRateError(s) === null,
  },
  {
    key: "oxygenSaturation",
    question: "What's your oxygen saturation (SpO2)?",
    helper: "As a percentage. Leave blank if you haven't checked it.",
    render: (v, set, state) => (
      <NumericField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 98" error={getOxygenSaturationError(state)} />
    ),
    isValid: (s) => getOxygenSaturationError(s) === null,
  },
  {
    key: "bloodPressureSystolic",
    question: "What's your systolic blood pressure?",
    helper: "The top number, in mmHg. Leave blank if you haven't checked it.",
    render: (v, set, state) => (
      <NumericField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 120" error={getSystolicError(state)} />
    ),
    isValid: (s) => getSystolicError(s) === null,
  },
  {
    key: "bloodPressureDiastolic",
    question: "What's your diastolic blood pressure?",
    helper: "The bottom number, in mmHg. Leave blank if you haven't checked it.",
    render: (v, set, state) => (
      <NumericField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 80" error={getDiastolicError(state)} />
    ),
    isValid: (s) => getDiastolicError(s) === null,
  },
  {
    key: "additionalSymptoms",
    question: "Any other symptoms? (comma-separated)",
    render: (v, set) => <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. sweating, nausea, dizziness" />,
    isValid: () => true,
  },
  {
    key: "medicalHistory",
    question: "Anything new or different for this visit? (comma-separated, optional)",
    helper: "Chronic conditions on file in your Medical Profile are already included automatically — this is only for anything extra relevant to today.",
    render: (v, set) => <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. recent injury, new symptom" />,
    isValid: () => true,
  },
  {
    key: "currentMedications",
    question: "Are you currently taking any medications?",
    render: (v, set) => <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. ibuprofen, metformin" />,
    isValid: () => true,
  },
  {
    key: "isPregnant",
    question: "Is there a chance you're currently pregnant?",
    required: true,
    skip: (s) => s.sex !== "Female",
    render: (v, set) => (
      <ChoiceField
        options={["Yes", "No"]}
        value={v === true ? "Yes" : v === false ? "No" : ""}
        onChange={(val) => (set as (v: boolean) => void)(val === "Yes")}
      />
    ),
    isValid: (s) => s.isPregnant !== null,
  },
  {
    key: "lifestyleFactors",
    question: "Anything about your lifestyle worth noting? (comma-separated, optional)",
    helper: "e.g. smoking, alcohol use, recent travel — whatever feels relevant.",
    render: (v, set) => <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. smoker, recent travel" />,
    isValid: () => true,
  },
];

function toCsvArray(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function calculateAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

type SubmitState =
  | { phase: "form" }
  | { phase: "submitting" }
  | { phase: "done"; assessment: Assessment; notice: string }
  | { phase: "error"; message: string };

export function SymptomChecker() {
  const router = useRouter();
  const [state, setState] = React.useState<IntakeState>(INITIAL_STATE);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [submitState, setSubmitState] = React.useState<SubmitState>({ phase: "form" });

  // Prefill age/sex from the stored medical profile so the patient doesn't
  // have to re-enter what's already on file — still editable per-visit,
  // and we never overwrite a value the patient has already started typing.
  React.useEffect(() => {
    apiFetch<MedicalProfile>("/patients/me/medical-profile")
      .then((profile) => {
        setState((prev) => {
          const next = { ...prev };
          if (!next.age) {
            const age = calculateAge(profile.patient.dateOfBirth);
            if (age !== null) next.age = String(age);
          }
          if (!next.sex) {
            const known = ["Female", "Male", "Other"];
            const match = known.find((o) => o.toLowerCase() === profile.patient.sex.toLowerCase());
            if (match) next.sex = match;
          }
          return next;
        });
      })
      .catch(() => {
        // Non-critical — if the profile can't be loaded, the patient just
        // answers age/sex manually as before.
      });
  }, []);

  const activeSteps = STEPS.filter((s) => !s.skip?.(state));
  const currentStep = activeSteps[stepIndex];
  const progress = ((stepIndex + 1) / activeSteps.length) * 100;

  if (!currentStep) return null;

  function updateField(key: keyof IntakeState, value: unknown) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleNext() {
    if (stepIndex < activeSteps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }

    setSubmitState({ phase: "submitting" });
    try {
      const temperatureNumeric = Number(state.temperatureValue);
      const temperatureCelsius =
        state.temperatureUnit === "C" ? temperatureNumeric : roundToOneDecimal(fahrenheitToCelsius(temperatureNumeric));

      const payload = {
        age: Number(state.age),
        sex: state.sex,
        primarySymptom: state.primarySymptom,
        painLevel: state.painLevel ? Number(state.painLevel) : undefined,
        durationHours: state.durationHours ? Number(state.durationHours) : undefined,
        temperatureCelsius,
        heartRate: state.heartRate ? Number(state.heartRate) : undefined,
        oxygenSaturation: state.oxygenSaturation ? Number(state.oxygenSaturation) : undefined,
        bloodPressureSystolic: state.bloodPressureSystolic ? Number(state.bloodPressureSystolic) : undefined,
        bloodPressureDiastolic: state.bloodPressureDiastolic ? Number(state.bloodPressureDiastolic) : undefined,
        additionalSymptoms: toCsvArray(state.additionalSymptoms),
        medicalHistory: toCsvArray(state.medicalHistory),
        currentMedications: toCsvArray(state.currentMedications),
        isPregnant: state.isPregnant ?? undefined,
        lifestyleFactors: toCsvArray(state.lifestyleFactors),
      };

      const res = await apiFetch<{ assessment: Assessment; notice: string }>("/assessments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSubmitState({ phase: "done", assessment: res.assessment, notice: res.notice });
    } catch (err) {
      setSubmitState({
        phase: "error",
        message: err instanceof ApiClientError ? err.message : "Couldn't submit your assessment. Please try again.",
      });
    }
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (submitState.phase === "done") {
    const { assessment, notice } = submitState;
    const snapshot = assessment.healthSnapshot?.snapshot;
    const profileParts: string[] = [];
    if (snapshot?.profile?.conditions?.length) {
      profileParts.push(snapshot.profile.conditions.map((c) => c.name).join(", "));
    }
    if (snapshot?.profile?.allergies?.length) {
      profileParts.push(`allergies: ${snapshot.profile.allergies.map((a) => a.substance).join(", ")}`);
    }
    const healthParts = (snapshot?.healthMetrics ?? []).map((m) => `${m.label.toLowerCase()} ${m.value}${m.unit}`);

    return (
      <div className="mx-auto max-w-lg rounded-card border border-clinical-border bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-800">
        {assessment.urgencyLevel && (
          <div className="mb-4 flex justify-center">
            <UrgencyBadge level={assessment.urgencyLevel} />
          </div>
        )}
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Your assessment has been submitted
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {assessment.recommendation?.explanation ??
            "A member of the care team will review your submission shortly."}
        </p>

        {(profileParts.length > 0 || healthParts.length > 0) && (
          <div className="mt-4 rounded-xl bg-clinical-gray p-3 text-left text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <p className="font-medium text-slate-600 dark:text-slate-300">Automatically included in this assessment:</p>
            {profileParts.length > 0 && <p className="mt-1">From your medical profile — {profileParts.join("; ")}</p>}
            {healthParts.length > 0 && <p className="mt-1">From connected health data — {healthParts.join(", ")}</p>}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">{notice}</p>
        <Button className="mt-6" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-clinical-border dark:bg-slate-800">
        <motion.div
          className="h-full rounded-full bg-clinical-blue"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="rounded-card border border-clinical-border bg-white p-8 dark:bg-slate-900 dark:border-slate-800">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.key}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {currentStep.question}
              {currentStep.required && (
                <span className="text-triage-emergency" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </h2>
            {currentStep.helper && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentStep.helper}</p>
            )}
            <div className="mt-5">
              {currentStep.render(state[currentStep.key], (v) => updateField(currentStep.key, v), state, setState)}
            </div>
          </motion.div>
        </AnimatePresence>

        {submitState.phase === "error" && (
          <p role="alert" className="mt-4 text-sm text-triage-emergency">
            {submitState.message}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={stepIndex === 0 || submitState.phase === "submitting"}>
            <ArrowLeft size={16} />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!currentStep.isValid(state) || submitState.phase === "submitting"}
          >
            {submitState.phase === "submitting" ? (
              <Loader2 className="animate-spin" size={16} />
            ) : stepIndex === activeSteps.length - 1 ? (
              "Submit"
            ) : (
              <>
                Next <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Step {stepIndex + 1} of {activeSteps.length}
      </p>
    </div>
  );
}
