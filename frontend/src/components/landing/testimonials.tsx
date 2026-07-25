"use client";

import { motion } from "framer-motion";

const QUOTES = [
  {
    quote:
      "Our night shift used to lose ten minutes per patient just sorting who needed to be seen first. Now that sorting happens before they've finished checking in.",
    role: "Charge Nurse, Emergency Department",
  },
  {
    quote:
      "What sold our safety committee wasn't the AI — it was that we could see exactly why it suggested each urgency level, every time.",
    role: "Clinical Informatics Lead",
  },
  {
    quote:
      "It doesn't try to replace triage judgment. It just makes sure nothing sits in a queue longer than it should.",
    role: "Attending Physician, Urgent Care",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="mb-12 font-display text-3xl font-bold text-slate-900 dark:text-white">
        Built with care teams, not just for them
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        {QUOTES.map((q, i) => (
          <motion.figure
            key={q.role}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
            className="rounded-card border border-clinical-border bg-white p-6 dark:bg-slate-900 dark:border-slate-800"
          >
            <blockquote className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              “{q.quote}”
            </blockquote>
            <figcaption className="mt-4 text-xs font-semibold uppercase tracking-wide text-clinical-blue">
              {q.role}
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
