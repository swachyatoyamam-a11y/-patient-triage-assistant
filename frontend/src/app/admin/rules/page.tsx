"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UrgencyBadge } from "@/components/ui/badge";
import { CardSkeletonList, ErrorState, EmptyState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Rule, UrgencyLevel } from "@/types/api";

const URGENCY_OPTIONS: UrgencyLevel[] = ["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"];

function TagMultiSelect({ tags, selected, onChange }: { tags: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            selected.includes(tag)
              ? "border-clinical-blue bg-clinical-blue text-white"
              : "border-clinical-border text-slate-600 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          {tag.replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
}

export default function AdminRulesPage() {
  const [rules, setRules] = React.useState<Rule[] | null>(null);
  const [knownTags, setKnownTags] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [allOf, setAllOf] = React.useState<string[]>([]);
  const [resultingUrgency, setResultingUrgency] = React.useState<UrgencyLevel>("URGENT");
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    setError(null);
    Promise.all([
      apiFetch<{ rules: Rule[] }>("/admin/rules"),
      apiFetch<{ tags: string[] }>("/admin/rules/tags"),
    ])
      .then(([rulesRes, tagsRes]) => {
        setRules(rulesRes.rules);
        setKnownTags(tagsRes.tags);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load rules."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (allOf.length === 0) {
      setFormError("Select at least one symptom tag.");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/admin/rules", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          condition: { allOf },
          resultingUrgency,
          isActive: true,
        }),
      });
      setName("");
      setDescription("");
      setAllOf([]);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Couldn't create that rule.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule? It will stop applying immediately.")) return;
    try {
      await apiFetch(`/admin/rules/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't delete that rule.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Triage rules</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add a new rule</CardTitle>
          <CardDescription>
            Rules are deterministic — they run before any AI analysis and can never be second-guessed by it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rule name, e.g. Severe abdominal pain"
              required
              className="w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for other admins"
              required
              className="w-full rounded-xl border border-clinical-border bg-white px-4 py-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                Must match ALL of these symptom tags:
              </p>
              <TagMultiSelect tags={knownTags} selected={allOf} onChange={setAllOf} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Resulting urgency:</label>
              <select
                value={resultingUrgency}
                onChange={(e) => setResultingUrgency(e.target.value as UrgencyLevel)}
                className="rounded-xl border border-clinical-border bg-white px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm text-triage-emergency">{formError}</p>}
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create rule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active rules</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}
          {!error && rules === null && <CardSkeletonList count={4} />}
          {!error && rules !== null && rules.length === 0 && (
            <EmptyState title="No rules yet" description="Add your first deterministic red-flag rule above." />
          )}
          {!error && rules !== null && rules.length > 0 && (
            <ul className="space-y-2">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between rounded-xl border border-clinical-border p-4 dark:border-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{rule.name}</p>
                    <p className="text-xs text-slate-400">{rule.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <UrgencyBadge level={rule.resultingUrgency} />
                    <button
                      onClick={() => remove(rule.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-triage-emergency/10 hover:text-triage-emergency"
                      title="Delete rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
