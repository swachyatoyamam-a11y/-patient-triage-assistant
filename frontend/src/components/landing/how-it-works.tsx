"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    step: "01",
    title: "Patient describes symptoms",
    description:
      "A conversational intake asks one question at a time — age, primary symptom, pain level, duration, history — adapting based on what's already been said.",
  },
  {
    step: "02",
    title: "Rules check for red flags first",
    description:
      "Before anything else runs, the deterministic engine checks for combinations that mean 'emergency' every time, regardless of what an AI model would say.",
  },
  {
    step: "03",
    title: "AI adds context and reasoning",
    description:
      "For everything else, the model estimates likely conditions, a confidence score, and a recommended department — with the reasoning shown alongside it.",
  },
  {
    step: "04",
    title: "A clinician reviews and acts",
    description:
      "The recommendation lands in the live clinical queue, sorted by urgency, where a nurse or doctor confirms it before anything happens next.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 dark:bg-slate-900/50">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 font-display text-3xl font-bold text-slate-900 dark:text-white">
          From symptom to care, in four steps
        </h2>
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
              className="border-l-2 border-clinical-blue/30 pl-4"
            >
              <span className="font-mono text-sm text-clinical-blue">{s.step}</span>
              <h3 className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{s.description}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
