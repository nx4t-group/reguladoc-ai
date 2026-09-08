"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import { NAV_ITEMS } from "./nav-config";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

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
        <nav className="space-y-0.5 px-3 py-4">
          {items.map((item) => {
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
        </nav>
      </SheetContent>
    </Sheet>
  );
}
