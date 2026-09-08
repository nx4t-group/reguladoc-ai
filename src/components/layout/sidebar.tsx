"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { NAV_ITEMS } from "./nav-config";

export function Sidebar({ role, planLabel }: { role: Role; planLabel: string }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-primary-foreground">
          <ShieldCheck className="h-4.5 w-4.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">RegulaDoc AI</span>
          <span className="text-[11px] text-sidebar-muted">Compliance documental</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-md border border-sidebar-border bg-white/5 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-sidebar-muted">Plano atual</p>
          <p className="text-sm font-medium text-sidebar-foreground">{planLabel}</p>
        </div>
      </div>
    </aside>
  );
}
