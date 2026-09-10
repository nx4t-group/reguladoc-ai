import {
  LayoutDashboard,
  FileStack,
  ShieldCheck,
  Scale,
  FileBarChart,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/dossiers", label: "Dossiês", icon: FileStack },
  { href: "/app/regulatory-monitor", label: "Governança Regulatória", icon: Scale, roles: ["admin", "gestor"] },
  { href: "/app/rules", label: "Motor de Regras", icon: ShieldCheck, roles: ["admin", "gestor"] },
  { href: "/app/reports", label: "Relatórios & Pareceres", icon: FileBarChart, roles: ["admin", "gestor"] },
  { href: "/app/settings", label: "Configurações", icon: Settings, roles: ["admin", "gestor"] },
  { href: "/app/admin", label: "Administração", icon: Users, roles: ["admin"] },
];

