"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { NAV_SECTIONS } from "./nav-config";

export function Sidebar({ role }: { role: Role; planLabel?: string }) {
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
    <aside className="sidebar-wood fixed inset-y-0 left-0 z-40 hidden w-72 flex-col justify-between border-r border-stone-800/80 text-stone-300 select-none lg:flex">
      <div>
        {/* ── MARCA & IDENTIDADE REGULATÓRIA ── */}
        <div className="px-6 py-5 border-b border-stone-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif tracking-wider text-xl font-bold text-stone-100">RegulaDoc</span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-leaf-700/80 text-emerald-100 border border-leaf-600/60">AI</span>
          </div>
        </div>

        {/* ── MENU PRINCIPAL ── */}
        <nav className="px-3.5 py-5 space-y-4 overflow-y-auto">
          {visibleSections.map((section, idx) => (
            <div key={section.title || `sec-${idx}`} className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
                {section.title || "Controle Regulatório"}
              </div>
              <div className="space-y-1">
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
                        "flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all",
                        isActive
                          ? "bg-bordeaux-800 text-stone-50 font-medium shadow-inner border border-bordeaux-700/60"
                          : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60",
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive ? "text-amber-200" : "text-stone-400",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399] shrink-0" />
                      ) : item.badge ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 font-sans font-semibold shrink-0">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
