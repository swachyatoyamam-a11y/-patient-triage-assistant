"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Brain, ListTree, FileOutput } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const FEATURES = [
  {
    icon: ListTree,
    title: "Deterministic red-flag rules",
    description:
      "Symptom combinations like chest pain with sweating, or difficulty breathing, are caught by explicit clinical rules before any AI runs — no model in the loop for the calls that can't wait.",
  },
  {
    icon: Brain,
    title: "Explainable AI recommendation",
    description:
      "Every suggested urgency level, department, and next step comes with a plain-language reason a clinician can check in seconds, not a black-box score.",
  },
  {
    icon: ShieldCheck,
    title: "Built for clinical oversight",
    description:
      "Nothing here is a diagnosis. Every assessment routes to a queue a nurse or doctor reviews, with full audit history of what the system suggested and why.",
  },
  {
    icon: FileOutput,
    title: "Reports your EHR team can use",
    description:
      "Downloadable, timestamped patient reports with symptoms, urgency, and recommendation — ready to attach to the chart.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 max-w-xl">
        <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Two systems, one queue
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Rules handle certainty. AI handles nuance. Clinicians make the call.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
          >
            <Card className="h-full">
              <CardHeader>
                <f.icon className="mb-3 text-clinical-blue" size={24} />
                <CardTitle>{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{f.description}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
