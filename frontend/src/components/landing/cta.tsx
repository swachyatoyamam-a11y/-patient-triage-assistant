import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="rounded-card bg-clinical-blueDark px-8 py-16 text-center">
        <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
          Ready to see it on your intake flow?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-clinical-gray/80">
          Set up takes an afternoon. Your clinical team keeps final say on every case.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login/patient">
            <Button size="lg" className="bg-white text-clinical-blueDark hover:bg-clinical-gray">
              Try patient intake
            </Button>
          </Link>
          <Link href="/login/admin">
            <Button size="lg" variant="secondary" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Talk to us as an admin
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
