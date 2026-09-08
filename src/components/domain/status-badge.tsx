import { Badge } from "@/components/ui/badge";
import {
  ALERT_STATUS_LABELS,
  DOSSIER_STATUS_BADGE,
  DOSSIER_STATUS_LABELS,
  REGULATORY_ITEM_STATUS_LABELS,
  SEVERITY_BADGE,
  SEVERITY_LABELS,
  type AlertSeverity,
  type AlertStatus,
  type DossierStatus,
  type RegulatoryItemStatus,
} from "@/lib/constants";

export function DossierStatusBadge({ status }: { status: DossierStatus | string }) {
  const key = status as DossierStatus;
  return <Badge variant={DOSSIER_STATUS_BADGE[key] ?? "neutral"}>{DOSSIER_STATUS_LABELS[key] ?? status}</Badge>;
}

export function SeverityBadge({ severity }: { severity: AlertSeverity | string }) {
  const key = severity as AlertSeverity;
  return <Badge variant={SEVERITY_BADGE[key] ?? "neutral"}>{SEVERITY_LABELS[key] ?? severity}</Badge>;
}

export function AlertStatusBadge({ status }: { status: AlertStatus | string }) {
  const key = status as AlertStatus;
  const variant = key === "resolvido" ? "success" : key === "rejeitado" || key === "falso_positivo" ? "neutral" : "warning";
  return <Badge variant={variant}>{ALERT_STATUS_LABELS[key] ?? status}</Badge>;
}

export function RegulatoryItemStatusBadge({ status }: { status: RegulatoryItemStatus | string }) {
  const key = status as RegulatoryItemStatus;
  const variant = key === "convertido_em_regra" ? "success" : key === "rejeitado" ? "neutral" : key === "novo" ? "info" : "warning";
  return <Badge variant={variant}>{REGULATORY_ITEM_STATUS_LABELS[key] ?? status}</Badge>;
}
