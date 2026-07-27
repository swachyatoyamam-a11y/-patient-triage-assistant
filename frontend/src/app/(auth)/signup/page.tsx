import Link from "next/link";
import { SignupForm } from "@/components/forms/signup-form";

export default function SignupPage() {
  return (
    <div>
      <SignupForm />
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login/patient" className="font-medium text-clinical-blue hover:underline">
          Sign in here
        </Link>
      </p>
    </div>
  );
}
