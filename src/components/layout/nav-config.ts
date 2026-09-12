import {
  LayoutDashboard,
  FileStack,
  ShieldCheck,
  Scale,
  FileBarChart,
  Settings,
  Users,
  History,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

export interface NavSection {
  title?: string;
  roles?: Role[];
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/app", label: "Painel", icon: LayoutDashboard },
      { href: "/app/dossiers", label: "Dossiês", icon: FileStack },
    ],
  },
  {
    title: "Governança",
    roles: ["admin", "gestor"],
    items: [
      { href: "/app/rules", label: "Regras", icon: ShieldCheck, roles: ["admin", "gestor"] },
      { href: "/app/regulatory-monitor", label: "Monitor Regulatório", icon: Scale, roles: ["admin", "gestor"] },
    ],
  },
  {
    title: "Gestão",
    roles: ["admin", "gestor"],
    items: [
      { href: "/app/reports", label: "Relatórios", icon: FileBarChart, roles: ["admin", "gestor"] },
      { href: "/app/audit", label: "Auditoria", icon: History, roles: ["admin", "gestor"] },
    ],
  },
  {
    title: "Administração",
    roles: ["admin"],
    items: [
      { href: "/app/admin", label: "Administração", icon: Users, roles: ["admin"] },
      { href: "/app/settings", label: "Configurações", icon: Settings, roles: ["admin"] },
    ],
  },
];

// Flattened fallback for backwards compatibility
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
