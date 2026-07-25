import Link from "next/link";
import { Activity } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-clinical-blueDark p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-display font-bold">
          <Activity size={22} />
          Triage Assistant
        </Link>
        <div>
          <p className="font-display text-2xl font-semibold leading-snug">
            Every login is scoped to exactly one role — patient, care team, or admin —
            so no one sees more than their job needs.
          </p>
        </div>
        <p className="text-xs text-white/50">
          Not a medical diagnosis. For emergencies, call your local emergency number.
        </p>
      </div>
      <div className="flex w-full items-center justify-center bg-clinical-gray px-6 dark:bg-slate-950 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
