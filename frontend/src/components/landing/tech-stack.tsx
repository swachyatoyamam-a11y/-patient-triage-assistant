import { Code2, Palette, Server, Database, Boxes, Sparkles } from "lucide-react";

const STACK = [
  { icon: Code2, label: "Next.js 15 + TypeScript" },
  { icon: Palette, label: "Tailwind CSS" },
  { icon: Server, label: "Node.js + Express" },
  { icon: Database, label: "PostgreSQL" },
  { icon: Boxes, label: "Prisma ORM" },
  { icon: Sparkles, label: "Google Gemini AI" },
];

export function TechStack() {
  return (
    <section className="border-y border-clinical-border bg-white py-10 dark:bg-slate-900/50 dark:border-slate-800">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Built with
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {STACK.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400"
            >
              <s.icon size={17} className="text-clinical-blue" />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
