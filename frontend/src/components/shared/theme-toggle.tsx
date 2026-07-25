"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-clinical-border text-slate-600 transition-colors hover:bg-clinical-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-blue dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
