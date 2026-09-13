"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { NAV_SECTIONS } from "./nav-config";

export function Sidebar({ role, planLabel }: { role: Role; planLabel: string }) {
  const pathname = usePathname();

  const visibleSections = NAV_SECTIONS.map((section) => {
    if (section.roles && !section.roles.includes(role)) {
      return null;
    }
    const filteredItems = section.items.filter((item) => !item.roles || item.roles.includes(role));
    if (filteredItems.length === 0) return null;
    return { ...section, items: filteredItems };
  }).filter(Boolean) as typeof NAV_SECTIONS;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      {/* ── LOGOMARCA ── */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <Link href="/painel" className="flex items-center gap-2.5">
          {/* Icon on dark navy bg */}
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-white/20">
            <Image
              src="/icon.png"
              alt="RegulaDoc AI"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13.5px] font-bold tracking-tight text-white">
              Regula<span className="text-brand-blue">Doc</span>
            </span>
            <span className="text-[10px] font-semibold text-brand-green/80 tracking-[0.2em] uppercase">Conferência Regulatória</span>
          </div>
        </Link>
      </div>

      {/* ── NAVEGAÇÃO ── */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {visibleSections.map((section, idx) => (
          <div key={section.title || `sec-${idx}`} className="space-y-0.5">
            {section.title && (
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-muted/50">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/painel"
                    ? pathname === "/painel"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-brand-green"
                          : "text-sidebar-muted/70 group-hover:text-sidebar-foreground",
                      )}
                    />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-green" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── PLANO ── */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-lg border border-sidebar-border/60 bg-white/5 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-muted/50">
            Plano atual
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-green" />
            <p className="text-[13px] font-semibold text-sidebar-foreground">{planLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
