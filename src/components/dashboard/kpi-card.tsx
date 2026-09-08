import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "danger" | "success" | "warning";
  hint?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    danger: "bg-severity-critical/10 text-severity-critical",
    success: "bg-status-success/10 text-status-success",
    warning: "bg-status-warning/10 text-status-warning",
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
