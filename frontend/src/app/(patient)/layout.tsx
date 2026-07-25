"use client";

import { DashboardShell, type NavLink } from "@/components/dashboard/dashboard-shell";
import { LayoutDashboard, Stethoscope, CalendarClock, FileText } from "lucide-react";

const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/assessment/new", label: "New assessment", icon: Stethoscope },
  { href: "/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell navLinks={navLinks} portalLabel="Patient portal">
      {children}
    </DashboardShell>
  );
}
