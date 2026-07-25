"use client";

import { DashboardShell, type NavLink } from "@/components/dashboard/dashboard-shell";
import { LayoutDashboard, Users } from "lucide-react";

const navLinks: NavLink[] = [
  { href: "/clinical/dashboard", label: "Live queue", icon: LayoutDashboard },
  { href: "/clinical/patients", label: "All patients", icon: Users },
];

export default function ClinicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell navLinks={navLinks} portalLabel="Clinical portal">
      {children}
    </DashboardShell>
  );
}
