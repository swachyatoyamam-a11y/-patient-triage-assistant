"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/shared/states";
import { metricLabel } from "@/lib/health-metrics";
import type { HealthMetricRecord } from "@/types/api";

/**
 * recharts' <ResponsiveContainer> relies on ResizeObserver, which doesn't
 * always fire in this codebase's automation/embedding contexts (same issue
 * already worked around in the admin dashboard) — measuring the container
 * ourselves sidesteps it entirely. Duplicated here rather than shared
 * because the two pages don't otherwise share a module.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    function measure() {
      if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
    }
    measure();
    window.addEventListener("resize", measure);
    const interval = setInterval(measure, 500);
    return () => {
      window.removeEventListener("resize", measure);
      clearInterval(interval);
    };
  }, []);
  return [ref, width] as const;
}

function byMetricType(metrics: HealthMetricRecord[]): Map<string, HealthMetricRecord[]> {
  const map = new Map<string, HealthMetricRecord[]>();
  for (const m of metrics) {
    const list = map.get(m.metricType) ?? [];
    list.push(m);
    map.set(m.metricType, list);
  }
  // Ascending by time for charting (the source list from the API is desc).
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }
  return map;
}

function withinHours(records: HealthMetricRecord[], hours: number): HealthMetricRecord[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return records.filter((r) => new Date(r.recordedAt).getTime() >= cutoff);
}

function chartPoints(records: HealthMetricRecord[]) {
  return records.map((r) => ({
    t: new Date(r.recordedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    value: r.value,
  }));
}

function TrendChart({
  title,
  unit,
  records,
  color = "#2a78d6",
}: {
  title: string;
  unit: string;
  records: HealthMetricRecord[];
  color?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const data = chartPoints(records);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {records.length} readings · latest {records[records.length - 1]!.value}
          {unit}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="w-full">
          {width > 0 && (
            <LineChart width={width} height={180} data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BloodPressureChart({ systolic, diastolic }: { systolic: HealthMetricRecord[]; diastolic: HealthMetricRecord[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  // Zip by index — both series come from the same sync events, so they're
  // recorded at (near-)identical timestamps in practice.
  const length = Math.max(systolic.length, diastolic.length);
  const data = Array.from({ length }, (_, i) => ({
    t: systolic[i] ? new Date(systolic[i]!.recordedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
    systolic: systolic[i]?.value,
    diastolic: diastolic[i]?.value,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Blood pressure (7d)</CardTitle>
        <CardDescription>
          Latest {systolic[systolic.length - 1]?.value ?? "—"}/{diastolic[diastolic.length - 1]?.value ?? "—"} mmHg
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="w-full">
          {width > 0 && (
            <LineChart width={width} height={180} data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" name="Systolic" dataKey="systolic" stroke="#eb6834" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" name="Diastolic" dataKey="diastolic" stroke="#2a78d6" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Recent readings across every connected source. A handful of metric types
 * get a small trend chart when there's enough data to make one meaningful;
 * everything else — including chart-eligible types with only one reading —
 * always has a row in the table below, so no data quietly disappears.
 */
export function HealthTimeline({ metrics, loading }: { metrics: HealthMetricRecord[] | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <EmptyState
        title="No readings yet"
        description="Connect a health data source above (Demo Health Data works immediately) to see recent readings and trends here."
      />
    );
  }

  const grouped = byMetricType(metrics);
  const heartRate = withinHours(grouped.get("HEART_RATE") ?? [], 24);
  const spo2 = grouped.get("SPO2") ?? [];
  const sleep = grouped.get("SLEEP_MINUTES") ?? [];
  const systolic = withinHours(grouped.get("BLOOD_PRESSURE_SYSTOLIC") ?? [], 24 * 7);
  const diastolic = withinHours(grouped.get("BLOOD_PRESSURE_DIASTOLIC") ?? [], 24 * 7);

  const charts: React.ReactNode[] = [];
  if (heartRate.length >= 2) {
    charts.push(<TrendChart key="hr" title="Heart rate (24h)" unit=" bpm" records={heartRate} color="#2a78d6" />);
  }
  if (systolic.length >= 2 || diastolic.length >= 2) {
    charts.push(<BloodPressureChart key="bp" systolic={systolic} diastolic={diastolic} />);
  }
  if (spo2.length >= 2) {
    charts.push(<TrendChart key="spo2" title="SpO2 trend" unit="%" records={spo2} color="#1baf7a" />);
  }
  if (sleep.length >= 2) {
    charts.push(<TrendChart key="sleep" title="Sleep trend" unit=" min" records={sleep} color="#7c3aed" />);
  }

  const tableRows = [...metrics].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()).slice(0, 30);

  return (
    <div className="space-y-6">
      {charts.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{charts}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent readings</CardTitle>
          <CardDescription>Every reading currently on file, most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clinical-border text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Metric</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.id} className="border-b border-clinical-border last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{metricLabel(r.metricType)}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                    {r.value}
                    {r.unit}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                    {r.source}
                    {r.metadata?.synthetic && (
                      <span className="ml-1.5 rounded-full bg-triage-moderate/10 px-1.5 py-0.5 text-[10px] font-medium text-triage-moderate">
                        synthetic
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{timeAgo(r.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
