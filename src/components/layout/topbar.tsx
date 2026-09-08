"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Search, Settings, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROLE_LABELS, SEVERITY_BADGE, SEVERITY_LABELS, type AlertSeverity, type Role } from "@/lib/constants";
import { MobileNav } from "./mobile-nav";

export interface TopbarNotification {
  id: string;
  title: string;
  dossierId: string;
  dossierInternalNumber: string;
  severity: AlertSeverity;
}

interface SearchResult {
  id: string;
  internalNumber: string;
  importerName: string;
  brand: string;
  productName: string;
  status: string;
}

export function Topbar({
  name,
  email,
  role,
  organizationName,
  notifications,
}: {
  name: string;
  email: string;
  role: Role;
  organizationName: string;
  notifications: TopbarNotification[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.dossiers ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <MobileNav role={role} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Buscar dossiê, importador, marca, lote…"
              className="pl-8"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[420px] p-1">
          {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum dossiê encontrado.</p>
          )}
          {!loading &&
            results.map((r) => (
              <Link
                key={r.id}
                href={`/app/dossiers/${r.id}`}
                onClick={() => setOpen(false)}
                className="block rounded-sm px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{r.internalNumber}</span>
                <span className="text-muted-foreground"> — {r.brand} · {r.productName}</span>
                <p className="text-xs text-muted-foreground">{r.importerName}</p>
              </Link>
            ))}
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4.5 w-4.5" />
              {notifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-severity-critical" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Alertas críticos recentes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum alerta crítico em aberto.</p>
            )}
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => router.push(`/app/dossiers/${n.dossierId}/review`)}>
                <div className="flex w-full items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.dossierInternalNumber}</p>
                  </div>
                  <Badge variant={SEVERITY_BADGE[n.severity]}>{SEVERITY_LABELS[n.severity]}</Badge>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary">{initials || <UserRound className="h-4 w-4" />}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <p className="font-medium">{name}</p>
              <p className="text-xs font-normal text-muted-foreground">{email}</p>
              <p className="mt-1 text-xs font-normal text-muted-foreground">{organizationName}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/settings">
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
