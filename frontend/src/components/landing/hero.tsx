"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { URGENCY_META, type UrgencyLevel } from "@/lib/utils";

type QueueChip = {
  id: string;
  label: string;
  level: UrgencyLevel;
  wait: string;
};

// Representative, fully anonymized — this is the product's real behavior,
// not a decorative animation: symptoms come in, urgency sorts them.
const QUEUE: QueueChip[] = [
  { id: "P-2214", label: "Chest pain, sweating", level: "EMERGENCY", wait: "Now" },
  { id: "P-2219", label: "Head injury, dizziness", level: "EMERGENCY", wait: "Now" },
  { id: "P-2201", label: "High fever, infant", level: "URGENT", wait: "~8 min" },
  { id: "P-2208", label: "Deep laceration", level: "URGENT", wait: "~12 min" },
  { id: "P-2233", label: "Persistent cough", level: "MODERATE", wait: "~35 min" },
  { id: "P-2241", label: "Sprained ankle", level: "MODERATE", wait: "~40 min" },
  { id: "P-2255", label: "Minor cold symptoms", level: "ROUTINE", wait: "~1 hr" },
];

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center rounded-full bg-clinical-blue/10 px-3 py-1 text-xs font-semibold text-clinical-blue">
            Clinician-reviewed, always
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] text-slate-900 dark:text-white md:text-5xl">
            Every patient sorted by
            <br />
            how urgently they need care.
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-600 dark:text-slate-300">
            Patients describe symptoms in plain language. A deterministic rule
            engine catches red flags instantly, an AI layer explains its
            reasoning, and your care team stays in control of every call.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login/patient">
              <Button size="lg">Start an assessment</Button>
            </Link>
            <Link href="/login/staff">
              <Button size="lg" variant="secondary">View clinical dashboard</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Not a diagnosis. Every recommendation is reviewed by a licensed clinician.
          </p>
        </div>

        {/* Signature element: a live-feeling, color-sorted triage queue */}
        <div className="relative rounded-card border border-clinical-border bg-white p-5 shadow-lg dark:bg-slate-900 dark:border-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-slate-700 dark:text-slate-200">
              Live queue
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-triage-routine" />
              Updating in real time
            </span>
          </div>
          <ul className="space-y-2">
            {QUEUE.map((chip, i) => {
              const meta = URGENCY_META[chip.level];
              return (
                <motion.li
                  key={chip.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
                  className="flex items-center justify-between rounded-xl border border-clinical-border bg-clinical-gray/60 px-3 py-2.5 dark:bg-slate-800/60 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClass}`} />
                    <div>
                      <p className="font-mono text-xs text-slate-400">{chip.id}</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {chip.label}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${meta.colorClass}`}>{chip.wait}</span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
