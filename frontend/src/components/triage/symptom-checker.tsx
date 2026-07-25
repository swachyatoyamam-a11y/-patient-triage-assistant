"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrgencyBadge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Assessment } from "@/types/api";

type IntakeState = {
  age: string;
  sex: string;
  primarySymptom: string;
  painLevel: string;
  durationHours: string;
  temperatureCelsius: string;
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
  temperatureCelsius: "",
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
  render: (value: unknown, set: (v: unknown) => void) => React.ReactNode;
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

const STEPS: Step[] = [
  {
    key: "age",
    question: "What is your age?",
    render: (v, set) => <TextField type="number" value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 34" />,
    isValid: (s) => s.age.trim() !== "" && Number(s.age) >= 0 && Number(s.age) <= 120,
  },
  {
    key: "sex",
    question: "What is your sex?",
    helper: "Used to interpret certain symptoms correctly — not shared beyond your care team.",
    render: (v, set) => <ChoiceField options={["Female", "Male", "Other"]} value={v as string} onChange={set as (v: string) => void} />,
    isValid: (s) => s.sex.trim() !== "",
  },
  {
    key: "primarySymptom",
    question: "What's the main symptom bringing you in today?",
    render: (v, set) => (
      <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. chest pain, sore throat, head injury" />
    ),
    isValid: (s) => s.primarySymptom.trim().length > 0,
  },
  {
    key: "painLevel",
    question: "On a scale of 0–10, how severe is it?",
    helper: "0 is no pain at all, 10 is the worst pain you can imagine.",
    render: (v, set) => (
      <ChoiceField options={Array.from({ length: 11 }, (_, i) => String(i))} value={v as string} onChange={set as (v: string) => void} />
    ),
    isValid: (s) => s.painLevel !== "",
  },
  {
    key: "durationHours",
    question: "About how many hours have you had this symptom?",
    render: (v, set) => <TextField type="number" value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 6" />,
    isValid: (s) => s.durationHours.trim() !== "",
  },
  {
    key: "temperatureCelsius",
    question: "Do you have a fever? If so, what's your temperature (°C)?",
    helper: "Leave blank if you haven't taken your temperature or don't have one.",
    render: (v, set) => <TextField type="number" value={v as string} onChange={set as (v: string) => void} placeholder="e.g. 38.5" />,
    isValid: () => true,
  },
  {
    key: "additionalSymptoms",
    question: "Any other symptoms? (comma-separated)",
    render: (v, set) => <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. sweating, nausea, dizziness" />,
    isValid: () => true,
  },
  {
    key: "medicalHistory",
    question: "Any relevant medical history? (comma-separated)",
    render: (v, set) => <TextField value={v as string} onChange={set as (v: string) => void} placeholder="e.g. asthma, diabetes" />,
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
      const payload = {
        age: Number(state.age),
        sex: state.sex,
        primarySymptom: state.primarySymptom,
        painLevel: state.painLevel ? Number(state.painLevel) : undefined,
        durationHours: state.durationHours ? Number(state.durationHours) : undefined,
        temperatureCelsius: state.temperatureCelsius ? Number(state.temperatureCelsius) : undefined,
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
            </h2>
            {currentStep.helper && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentStep.helper}</p>
            )}
            <div className="mt-5">
              {currentStep.render(state[currentStep.key], (v) => updateField(currentStep.key, v))}
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
