"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { NAV_SECTIONS } from "./nav-config";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const visibleSections = NAV_SECTIONS.map((section) => {
    if (section.roles && !section.roles.includes(role)) {
      return null;
    }
    const filteredItems = section.items.filter((item) => !item.roles || item.roles.includes(role));
    if (filteredItems.length === 0) return null;
    return { ...section, items: filteredItems };
  }).filter(Boolean) as typeof NAV_SECTIONS;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="border-b border-sidebar-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
            <ShieldCheck className="h-5 w-5" /> RegulaDoc AI
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-4 px-3 py-4">
          {visibleSections.map((section, idx) => (
            <div key={section.title || `mob-sec-${idx}`} className="space-y-1">
              {section.title && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                        isActive ? "bg-sidebar-accent text-white" : "text-sidebar-muted hover:bg-white/5",
                      )}
                    >
                      <Icon className="h-4 w-4" />
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
