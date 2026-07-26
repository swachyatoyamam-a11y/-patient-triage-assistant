import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export default function StaffLoginPage() {
  return (
    <div>
      <LoginForm
        redirectTo="/clinical/dashboard"
        heading="Care team sign in"
        subheading="View the live triage queue and patient assessments."
        allowedRoles={["NURSE", "DOCTOR"]}
      />
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Patient?{" "}
        <Link href="/login/patient" className="font-medium text-clinical-blue hover:underline">
          Sign in here
        </Link>
        {" · "}
        <Link href="/login/admin" className="font-medium text-clinical-blue hover:underline">
          Admin sign in
        </Link>
      </p>
    </div>
  );
}
