import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Org-level configuration (notification templates, department routing, data retention) isn't built
            yet — this page is a placeholder rather than a working feature. The pieces it'll eventually
            control (Notification model, department strings on Recommendation) already exist in the backend.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
