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
    <aside className="sidebar-wood fixed inset-y-0 left-0 z-40 hidden w-72 flex-col justify-between border-r border-stone-800/80 text-stone-300 select-none lg:flex">
      <div>
        {/* ── MARCA & IDENTIDADE REGULATÓRIA ── */}
        <div className="px-6 py-5 border-b border-stone-800/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-bordeaux-800 to-bordeaux-950 flex items-center justify-center border border-bordeaux-700/50 shadow-md p-1.5 shrink-0">
            <Image
              src="/icon.png"
              alt="RegulaDoc AI"
              width={32}
              height={32}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif tracking-wider text-base font-bold text-stone-100">RegulaDoc</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-leaf-700/80 text-emerald-100 border border-leaf-600/60">AI</span>
            </div>
            <p className="text-[11px] text-stone-400 font-medium tracking-wide">Vinhos • MAPA / Siscomex</p>
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 font-mono shrink-0">
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

      {/* ── RODAPÉ DA BARRA LATERAL: STATUS & PLANO ── */}
      <div className="p-4 border-t border-stone-800/70 space-y-3 bg-black/25">
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> SIPEAGRO / MAPA
          </span>
          <span className="text-[11px] text-stone-400 font-mono">780ms OK</span>
        </div>
        <div className="rounded-lg bg-stone-900/90 p-3 border border-stone-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-wider uppercase font-semibold text-amber-200">Plano Ativo</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Conformidade Total</span>
          </div>
          <div className="mt-1 font-medium text-xs text-stone-200">{planLabel || "Professional Vinícola"}</div>
          <p className="text-[11px] text-stone-400 mt-0.5 truncate">Barrinhas Comércio • Dossiês Vinhos</p>
        </div>
      </div>
    </aside>
  );
}
