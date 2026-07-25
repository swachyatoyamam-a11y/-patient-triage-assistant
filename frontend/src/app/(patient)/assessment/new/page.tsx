import { SymptomChecker } from "@/components/triage/symptom-checker";

export default function NewAssessmentPage() {
  return (
    <div>
      <div className="mx-auto mb-6 max-w-lg text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Tell us what's going on
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A few quick questions — this takes about two minutes.
        </p>
      </div>
      <SymptomChecker />
    </div>
  );
}
