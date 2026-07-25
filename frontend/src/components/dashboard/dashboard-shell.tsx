"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export type NavLink = { href: string; label: string; icon: LucideIcon };

export function DashboardShell({
  navLinks,
  portalLabel,
  children,
}: {
  navLinks: NavLink[];
  portalLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useCurrentUser();

  return (
    <div className="flex min-h-screen bg-clinical-gray dark:bg-slate-950">
      <aside className="hidden w-64 flex-col border-r border-clinical-border bg-white p-5 dark:bg-slate-900 dark:border-slate-800 md:flex">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-clinical-blueDark dark:text-white">
          <Activity className="text-clinical-blue" size={20} />
          Triage Assistant
        </Link>
        <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          {portalLabel}
        </span>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-clinical-blue/10 text-clinical-blue"
                    : "text-slate-600 hover:bg-clinical-gray dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="mt-auto flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-clinical-gray hover:text-triage-emergency dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-clinical-border bg-white px-4 sm:px-6 dark:bg-slate-900 dark:border-slate-800">
          <span className="font-display text-sm font-semibold text-slate-500 dark:text-slate-400 md:hidden">
            {portalLabel}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">{user.email}</span>
            )}
            <ThemeToggle />
            <button
              onClick={logout}
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-clinical-border text-slate-500 hover:bg-clinical-gray dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav — the sidebar above is desktop-only (md:flex),
          so this is the only way to switch sections on a phone. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-clinical-border bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] dark:bg-slate-900/95 dark:border-slate-800 md:hidden">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-clinical-blue" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <link.icon size={20} />
              <span className="truncate px-1">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
