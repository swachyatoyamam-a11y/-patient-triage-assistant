import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export default function PatientLoginPage() {
  return (
    <div>
      <LoginForm
        redirectTo="/dashboard"
        heading="Sign in to your care account"
        subheading="Start a symptom assessment or check on a previous one."
        allowedRoles={["PATIENT"]}
      />
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Care team member?{" "}
        <Link href="/login/staff" className="font-medium text-clinical-blue hover:underline">
          Sign in here
        </Link>
      </p>
    </div>
  );
}
