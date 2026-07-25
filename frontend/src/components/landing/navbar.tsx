import Link from "next/link";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-clinical-border bg-white/80 backdrop-blur dark:bg-slate-950/80 dark:border-slate-800">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-clinical-blueDark dark:text-white">
          <Activity className="text-clinical-blue" size={22} />
          Triage Assistant
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <a href="#features" className="hover:text-clinical-blue">Features</a>
          <a href="#how-it-works" className="hover:text-clinical-blue">How it works</a>
          <a href="#testimonials" className="hover:text-clinical-blue">Care teams</a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login/staff">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Staff login</Button>
          </Link>
          <Link href="/login/patient">
            <Button size="sm">Start an assessment</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
