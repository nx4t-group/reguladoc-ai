"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Search, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

const ROLE_AVATARS: Record<string, string> = {
  gestor: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  admin: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  analista: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
};

export function Topbar({
  name,
  email,
  role,
  avatarUrl,
  organizationName,
  notifications,
}: {
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
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

  const cleanName = name.replace(/demo/gi, "Teste");
  const cleanOrgName = organizationName.replace(/demo/gi, "Teste");
  const photoUrl =
    avatarUrl ||
    ROLE_AVATARS[role] ||
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6 lg:px-8 shadow-xs">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <MobileNav role={role} />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder="Buscar dossiê, importador, vinho, lote ou certificado analítico…"
                className="w-full pl-10 pr-12 py-2 border-stone-200 rounded-lg text-sm placeholder-stone-400 bg-stone-50/70 focus:bg-white focus:ring-1 focus:ring-bordeaux-800 focus:border-bordeaux-800 transition"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <kbd className="text-[10px] font-sans font-medium bg-stone-200/80 text-stone-500 px-1.5 py-0.5 rounded">⌘K</kbd>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[480px] p-2 bg-white rounded-xl border-stone-200 shadow-lg">
            {loading && <p className="px-3 py-2 text-sm text-stone-500">Buscando documentos e lotes…</p>}
            {!loading && results.length === 0 && query.trim().length >= 2 && (
              <p className="px-3 py-2 text-sm text-stone-500">Nenhum dossiê encontrado para a busca.</p>
            )}
            {!loading &&
              results.map((r) => (
                <Link
                  key={r.id}
                  href={`/painel/dossiers/${r.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-stone-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 tracking-tight">{r.internalNumber}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">{r.status}</Badge>
                  </div>
                  <p className="text-xs text-stone-700 font-medium mt-0.5">{r.brand} · {r.productName}</p>
                  <p className="text-[11px] text-stone-500">{r.importerName}</p>
                </Link>
              ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Ações do Cabeçalho & Perfil */}
      <div className="flex items-center gap-4 ml-6">

        {/* Notificações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
              aria-label="Notificações"
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-bordeaux-700 rounded-full ring-2 ring-white" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2 bg-white rounded-xl border-stone-200 shadow-lg">
            <DropdownMenuLabel className="text-xs font-semibold text-stone-800 uppercase tracking-wider">
              Alertas Críticos Regulatórios
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <p className="px-2 py-3 text-xs text-stone-500 text-center">Nenhum alerta crítico pendente.</p>
            )}
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => router.push(`/painel/dossiers/${n.dossierId}/review`)}
                className="cursor-pointer rounded-lg p-2 hover:bg-stone-50"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-stone-900 leading-snug">{n.title}</p>
                    <p className="text-[11px] text-stone-500 font-semibold mt-0.5">{n.dossierInternalNumber}</p>
                  </div>
                  <Badge variant={SEVERITY_BADGE[n.severity]}>{SEVERITY_LABELS[n.severity]}</Badge>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-stone-200 hidden sm:block" />

        {/* Perfil com Foto no Cabeçalho */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-stone-200 shadow-xs flex-shrink-0 bg-stone-100 ring-2 ring-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={cleanName}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1.5 ring-white" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-semibold text-stone-800 group-hover:text-bordeaux-800 leading-none">
                  {cleanName}
                </div>
                <div className="text-[11px] text-stone-500 mt-1 font-medium">
                  {ROLE_LABELS[role]}
                </div>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-white rounded-xl border-stone-200 shadow-lg p-1.5">
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-stone-200 shadow-xs flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt={cleanName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900 text-sm leading-tight truncate">{cleanName}</p>
                  <p className="text-xs text-stone-500 font-normal truncate">{email}</p>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-bordeaux-800 bg-bordeaux-50 px-2 py-0.5 rounded border border-bordeaux-200/60 inline-block">
                {cleanOrgName} • {ROLE_LABELS[role]}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2 text-xs">
              <Link href="/painel/settings">
                <Settings className="mr-2 h-4 w-4 text-stone-500" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair do Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
