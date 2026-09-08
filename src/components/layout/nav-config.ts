import {
  LayoutDashboard,
  FileStack,
  ShieldCheck,
  Radar,
  FileBarChart,
  Settings,
  Lock,
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
  { href: "/app/rules", label: "Regras", icon: ShieldCheck },
  { href: "/app/regulatory-monitor", label: "Monitor Regulatório", icon: Radar },
  { href: "/app/reports", label: "Relatórios", icon: FileBarChart },
  { href: "/app/settings", label: "Configurações", icon: Settings },
  { href: "/app/security", label: "Segurança", icon: Lock },
  { href: "/app/admin", label: "Admin", icon: Users, roles: ["admin"] },
];
