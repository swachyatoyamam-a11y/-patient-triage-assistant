"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { apiFetch, setToken, ApiClientError } from "@/lib/api-client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormProps = {
  /** Where this role lands after a successful sign-in. */
  redirectTo: string;
  /** Copy shown above the form, e.g. "Patient sign in". */
  heading: string;
  subheading: string;
};

type LoginResponse = { user: { id: string; role: string }; token: string };

/**
 * Presentational + client-validated login form.
 *
 * Auth note: this calls the backend's own JWT endpoint (`/api/auth/login`)
 * directly rather than Clerk. Clerk is still the long-term plan (see
 * middleware.ts), but it needs real API keys this environment doesn't have
 * — wiring the form to the backend that already exists and works gets you
 * an end-to-end login today. Swapping to Clerk later means replacing the
 * `apiFetch` call below with `useSignIn()`; nothing downstream (dashboards
 * calling `apiFetch`) needs to change either way.
 */
export function LoginForm({ redirectTo, heading, subheading }: LoginFormProps) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

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
      const { token } = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(result.data),
      });
      setToken(token);
      router.push(redirectTo);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Couldn't reach the server. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{heading}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subheading}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-triage-emergency">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-blue dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
          {errors.password && (
            <p id="password-error" className="mt-1 text-xs text-triage-emergency">
              {errors.password}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="text-sm text-triage-emergency">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
