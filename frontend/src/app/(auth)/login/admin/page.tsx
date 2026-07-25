import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export default function AdminLoginPage() {
  return (
    <div>
      <LoginForm
        redirectTo="/admin/dashboard"
        heading="Admin sign in"
        subheading="Manage users, triage rules, and system-wide analytics."
      />
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Not an admin?{" "}
        <Link href="/login/staff" className="font-medium text-clinical-blue hover:underline">
          Care team sign in
        </Link>
      </p>
    </div>
  );
}
