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
  badge?: string;
}

export interface NavSection {
  title?: string;
  roles?: Role[];
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Controle Regulatório",
    items: [
      { href: "/painel", label: "Painel Operacional", icon: LayoutDashboard },
      { href: "/painel/dossiers", label: "Dossiês de Importação", icon: FileStack, badge: "6" },
      { href: "/painel/rules", label: "Motor de Regras Viti-MAPA", icon: ShieldCheck, badge: "15 ativas" },
      { href: "/painel/regulatory-monitor", label: "Alertas & Findings", icon: Scale, badge: "13" },
      { href: "/painel/audit", label: "Auditoria MAPA v1.4", icon: History },
      { href: "/painel/reports", label: "Tabelas Enológicas", icon: FileBarChart },
    ],
  },
  {
    title: "Administração",
    roles: ["admin"],
    items: [
      { href: "/painel/admin", label: "Equipe & Acessos", icon: Users, roles: ["admin"] },
      { href: "/painel/settings", label: "Configurações", icon: Settings, roles: ["admin"] },
    ],
  },
];

// Flattened fallback for backwards compatibility
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
