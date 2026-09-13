"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { NAV_SECTIONS } from "./nav-config";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const visibleSections = NAV_SECTIONS.map((section) => {
    if (section.roles && !section.roles.includes(role)) return null;
    const filteredItems = section.items.filter((item) => !item.roles || item.roles.includes(role));
    if (filteredItems.length === 0) return null;
    return { ...section, items: filteredItems };
  }).filter(Boolean) as typeof NAV_SECTIONS;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-r border-stone-800/80 sidebar-wood p-0 text-stone-300">
        <div className="flex h-16 items-center border-b border-stone-800/60 px-5 gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-bordeaux-800 to-bordeaux-950 flex items-center justify-center border border-bordeaux-700/50 shadow-md p-1 shrink-0">
            <Image
              src="/icon.png"
              alt="RegulaDoc AI"
              width={28}
              height={28}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif tracking-wider text-sm font-bold text-stone-100">RegulaDoc</span>
              <span className="text-[9px] uppercase font-bold tracking-widest px-1 py-0.2 rounded bg-leaf-700/80 text-emerald-100 border border-leaf-600/60">AI</span>
            </div>
            <p className="text-[10px] text-stone-400 font-medium">Vinhos • MAPA / Siscomex</p>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3.5 py-5">
          {visibleSections.map((section, idx) => (
            <div key={section.title || `sec-${idx}`} className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
                {section.title || "Controle Regulatório"}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.href === "/painel" ? pathname === "/painel" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm transition-all",
                        isActive
                          ? "bg-bordeaux-800 text-stone-50 font-medium shadow-inner border border-bordeaux-700/60"
                          : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60",
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-amber-200" : "text-stone-400")} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399] shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
