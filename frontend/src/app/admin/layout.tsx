"use client";

import { DashboardShell, type NavLink } from "@/components/dashboard/dashboard-shell";
import { LayoutDashboard, Users, ListTree, ScrollText, Settings } from "lucide-react";

const navLinks: NavLink[] = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/rules", label: "Triage rules", icon: ListTree },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell navLinks={navLinks} portalLabel="Admin portal">
      {children}
    </DashboardShell>
  );
}
