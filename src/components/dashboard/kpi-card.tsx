import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "danger" | "success" | "warning";
  hint?: string;
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    danger: "bg-severity-critical/10 text-severity-critical",
    success: "bg-status-success/10 text-status-success",
    warning: "bg-status-warning/10 text-status-warning",
  };

  const cardContent = (
    <CardContent className="flex items-center gap-5 p-6">
      <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <p className="text-4xl font-bold tracking-tight text-foreground leading-none">{value}</p>
        <p className="mt-1.5 text-[13px] font-medium text-muted-foreground truncate">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] text-muted-foreground/70">{hint}</p>}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer border-border/80">
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="border-border/80">
      {cardContent}
    </Card>
  );
}
