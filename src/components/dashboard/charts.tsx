"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DOSSIER_STATUS_LABELS, SEVERITY_LABELS, type AlertSeverity, type DossierStatus } from "@/lib/constants";

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critica: "hsl(var(--severity-critical))",
  alta: "hsl(var(--severity-high))",
  media: "hsl(var(--severity-medium))",
  baixa: "hsl(var(--severity-low))",
  informativa: "hsl(var(--severity-info))",
};

export function DossiersByStatusChart({ data }: { data: { status: DossierStatus; count: number }[] }) {
  const chartData = data.map((d) => ({ label: DOSSIER_STATUS_LABELS[d.status] ?? d.status, count: d.count }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
            color: "hsl(var(--popover-foreground))",
          }}
        />
        <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={16} name="Dossiês" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AlertsBySeverityChart({ data }: { data: { severity: AlertSeverity; count: number }[] }) {
  const chartData = data.filter((d) => d.count > 0).map((d) => ({ label: SEVERITY_LABELS[d.severity], value: d.count, severity: d.severity }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Nenhum alerta em aberto — ótimo sinal.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {chartData.map((entry) => (
            <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
            color: "hsl(var(--popover-foreground))",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
