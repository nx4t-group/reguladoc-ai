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
      <SheetContent side="left" className="w-64 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Link href="/painel" className="flex items-center gap-2.5">
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
                  const isActive = item.href === "/painel" ? pathname === "/painel" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-green" : "text-sidebar-muted/70")} />
                      {item.label}
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
