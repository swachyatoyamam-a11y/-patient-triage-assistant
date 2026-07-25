export function Footer() {
  return (
    <footer className="border-t border-clinical-border py-10 dark:border-slate-800">
      <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-400">
        <p>
          This tool assists triage prioritization and does not provide a medical
          diagnosis. In an emergency, call your local emergency number immediately.
        </p>
        <p className="mt-2">© {new Date().getFullYear()} Patient Triage Assistant.</p>
      </div>
    </footer>
  );
}
