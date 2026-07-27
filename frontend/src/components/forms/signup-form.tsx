"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { apiFetch, setToken, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const signupSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    phone: z.string().min(7, "Enter a valid phone number"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().min(1, "Gender is required"),
    medicalHistory: z.string().optional(),
    allergies: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupResponse = { user: { id: string; role: string }; token: string };

const inputClass =
  "w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200";
const errorClass = "mt-1 text-xs text-triage-emergency";

/** Red asterisk marker for mandatory fields (see requirement: mark all
 * mandatory fields with a red asterisk). */
function Required() {
  return (
    <span className="text-triage-emergency" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

/** Whole years between the given date-of-birth string and today. Returns
 * null while the field is empty/unparseable so callers can show a
 * placeholder instead of a bogus age. */
function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Patient self-registration form. Posts to /auth/signup (patient-only,
 * role is never client-supplied — see backend/src/validators/auth.validator.ts)
 * and auto-logs the new account in on success, matching LoginForm's token
 * handling so downstream pages don't need to know how the account was made.
 */
export function SignupForm() {
  const router = useRouter();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const age = React.useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const raw = Object.fromEntries(formData.entries());
    const result = signupSchema.safeParse(raw);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const { token } = await apiFetch<SignupResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(result.data),
      });
      setToken(token);
      router.push("/dashboard");
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Couldn't reach the server. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        Create your care account
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Register once to start symptom assessments and track your care history.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="fullName" className={labelClass}>
              Full Name
              <Required />
            </label>
            <input id="fullName" name="fullName" type="text" autoComplete="name" className={inputClass} />
            {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
              <Required />
            </label>
            <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone Number
              <Required />
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputClass} />
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
              <Required />
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className={inputClass}
            />
            {errors.password && <p className={errorClass}>{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm Password
              <Required />
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
            />
            {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
          </div>

          <div>
            <label htmlFor="dateOfBirth" className={labelClass}>
              Date of Birth
              <Required />
            </label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
            />
            {errors.dateOfBirth && <p className={errorClass}>{errors.dateOfBirth}</p>}
          </div>

          <div>
            <label htmlFor="age" className={labelClass}>
              Age
            </label>
            <input
              id="age"
              type="text"
              readOnly
              value={age === null ? "" : `${age} years`}
              placeholder="Auto-calculated from date of birth"
              className={cn(inputClass, "cursor-not-allowed bg-clinical-gray text-slate-500 dark:bg-slate-900 dark:text-slate-400")}
            />
          </div>

          <div>
            <label htmlFor="gender" className={labelClass}>
              Gender
              <Required />
            </label>
            <select id="gender" name="gender" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Select gender
              </option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            {errors.gender && <p className={errorClass}>{errors.gender}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="medicalHistory" className={labelClass}>
              Medical History <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="medicalHistory"
              name="medicalHistory"
              rows={2}
              placeholder="e.g. Hypertension, asthma"
              className={inputClass}
            />
            {errors.medicalHistory && <p className={errorClass}>{errors.medicalHistory}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="allergies" className={labelClass}>
              Allergies <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="allergies"
              name="allergies"
              type="text"
              placeholder="e.g. Penicillin, peanuts"
              className={inputClass}
            />
            {errors.allergies && <p className={errorClass}>{errors.allergies}</p>}
          </div>

          <div>
            <label htmlFor="emergencyContactName" className={labelClass}>
              Emergency Contact Name <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="emergencyContactName" name="emergencyContactName" type="text" className={inputClass} />
            {errors.emergencyContactName && <p className={errorClass}>{errors.emergencyContactName}</p>}
          </div>

          <div>
            <label htmlFor="emergencyContactPhone" className={labelClass}>
              Emergency Contact Phone <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" className={inputClass} />
            {errors.emergencyContactPhone && <p className={errorClass}>{errors.emergencyContactPhone}</p>}
          </div>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-triage-emergency">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
