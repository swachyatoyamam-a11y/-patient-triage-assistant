"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeletonList, EmptyState, ErrorState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  reason: string | null;
  doctor?: { user: { firstName: string; lastName: string } } | null;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [booking, setBooking] = React.useState(false);

  const load = React.useCallback(() => {
    setError(null);
    setAppointments(null);
    apiFetch<{ appointments: Appointment[] }>("/appointments/me")
      .then((res) => setAppointments(res.appointments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load appointments."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) return;
    setBooking(true);
    try {
      await apiFetch("/appointments", {
        method: "POST",
        body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString(), reason: reason || undefined }),
      });
      setScheduledAt("");
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't book that appointment.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Appointments</h1>

      <Card>
        <CardHeader>
          <CardTitle>Book a new appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBook} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Date &amp; time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
                className="w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Follow-up, check-up…"
                className="w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <Button type="submit" disabled={booking}>
              {booking ? "Booking…" : "Book"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming &amp; past appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}
          {!error && appointments === null && <CardSkeletonList count={2} />}
          {!error && appointments !== null && appointments.length === 0 && (
            <EmptyState title="No appointments yet" description="Anything you book will show up here." />
          )}
          {!error && appointments !== null && appointments.length > 0 && (
            <ul className="space-y-3">
              {appointments.map((appt) => (
                <li
                  key={appt.id}
                  className="flex items-center justify-between rounded-xl border border-clinical-border p-4 dark:border-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {new Date(appt.scheduledAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {appt.reason ?? "General visit"}
                      {appt.doctor && ` · Dr. ${appt.doctor.user.firstName} ${appt.doctor.user.lastName}`}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-clinical-blue">
                    {appt.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
