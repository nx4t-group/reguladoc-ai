"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ShieldAlert,
  Table as TableIcon,
  LayoutGrid,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { DossierStatusBadge } from "@/components/domain/status-badge";

export interface DossierRow {
  id: string;
  internalNumber: string;
  importerName: string;
  productName: string;
  brand: string;
  batchNumber: string | null;
  countryOrigin: string | null;
  status: string;
  complianceScore: number | null;
  criticalAlerts: number;
  assignedToName: string | null;
  updatedAt: string;
}

const columns: ColumnDef<DossierRow>[] = [
  {
    accessorKey: "internalNumber",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 text-xs font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Dossiê
        <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link href={`/app/dossiers/${row.original.id}`} className="font-semibold text-primary hover:underline">
        {row.original.internalNumber}
      </Link>
    ),
  },
  {
    accessorKey: "importerName",
    header: "Cliente / Importador",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.importerName}</span>,
  },
  {
    accessorKey: "productName",
    header: "Produto / Itens",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate">
        <p className="font-medium text-foreground">{row.original.brand}</p>
        <p className="text-xs text-muted-foreground truncate">{row.original.productName}</p>
      </div>
    ),
  },
  {
    accessorKey: "countryOrigin",
    header: "Origem",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.countryOrigin ?? "—"}</span>,
  },
  {
    accessorKey: "status",
    header: "Etapa",
    cell: ({ row }) => <DossierStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "criticalAlerts",
    header: "Blockers",
    cell: ({ row }) =>
      row.original.criticalAlerts > 0 ? (
        <Badge variant="critical" className="gap-1 text-xs">
          <ShieldAlert className="h-3 w-3" /> {row.original.criticalAlerts}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">0</span>
      ),
  },
  {
    accessorKey: "complianceScore",
    header: "Score",
    cell: ({ row }) =>
      row.original.complianceScore == null ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <span className="text-xs font-semibold">{row.original.complianceScore} pts</span>
      ),
  },
  {
    accessorKey: "assignedToName",
    header: "Responsável",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.assignedToName ?? "—"}</span>,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 text-xs font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Atualização
        <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {format(new Date(row.original.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="text-right block">Próxima Ação</span>,
    cell: ({ row }) => {
      const isDocs =
        row.original.status === "AWAITING_DOCUMENTS" ||
        row.original.status === "documentos_pendentes" ||
        row.original.status === "DRAFT";
      const hasBlockers = row.original.criticalAlerts > 0;
      const label = isDocs ? "Documentar" : hasBlockers ? "Revisar" : "Conferir";
      return (
        <div className="text-right">
          <Button size="sm" variant={hasBlockers ? "default" : "outline"} className="h-7 text-xs px-2.5" asChild>
            <Link href={`/app/dossiers/${row.original.id}`}>
              {label} <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      );
    },
  },
];

export function DossiersTable({ data }: { data: DossierRow[] }) {
  const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [quickFilter, setQuickFilter] = React.useState<string>("todos");
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const filteredData = React.useMemo(() => {
    let list = data;
    if (quickFilter === "awaiting_docs") {
      list = list.filter((d) => d.status === "AWAITING_DOCUMENTS" || d.status === "documentos_pendentes" || d.status === "DRAFT");
    } else if (quickFilter === "in_review") {
      list = list.filter((d) => d.status === "IN_REVIEW" || d.status === "em_revisao" || d.status === "READY_FOR_REVIEW");
    } else if (quickFilter === "blocked") {
      list = list.filter((d) => d.status === "BLOCKED" || d.criticalAlerts > 0);
    } else if (quickFilter === "ready_approval") {
      list = list.filter((d) => d.status === "READY_FOR_APPROVAL" || d.status === "APPROVED" || d.status === "aprovado");
    }

    if (!globalFilter) return list;
    const term = globalFilter.toLowerCase();
    return list.filter(
      (d) =>
        d.internalNumber.toLowerCase().includes(term) ||
        d.importerName.toLowerCase().includes(term) ||
        d.productName.toLowerCase().includes(term) ||
        d.brand.toLowerCase().includes(term) ||
        (d.batchNumber && d.batchNumber.toLowerCase().includes(term))
    );
  }, [data, quickFilter, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* FILTROS E CONTROLES SUPERIORES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* BUSCA RÁPIDA */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por dossiê, importador, marca..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>

        {/* QUICK TABS + VIEW TOGGLE */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={quickFilter} onValueChange={setQuickFilter}>
            <SelectTrigger className="h-9 w-48 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Filtrar por etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os processos ({data.length})</SelectItem>
              <SelectItem value="awaiting_docs">Aguardando Documentos</SelectItem>
              <SelectItem value="in_review">Em Revisão</SelectItem>
              <SelectItem value="blocked">Bloqueados / Com Blockers</SelectItem>
              <SelectItem value="ready_approval">Recomendados / Aprovados</SelectItem>
            </SelectContent>
          </Select>

          {/* TOGGLE TABELA / CARDS */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <TableIcon className="h-3.5 w-3.5" />
              Tabela
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </Button>
          </div>
        </div>
      </div>

      {/* VISUALIZAÇÃO EM TABELA (PADRÃO) */}
      {viewMode === "table" ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/40 text-xs">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum processo encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="text-xs">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* PAGINAÇÃO */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row text-xs text-muted-foreground">
            <div>
              Mostrando {table.getRowModel().rows.length} de {filteredData.length} processos
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VISUALIZAÇÃO EM CARDS (OPCIONAL) */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredData.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
              Nenhum processo encontrado.
            </div>
          )}
          {filteredData.map((d) => (
            <Card key={d.id} className="border border-border hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-primary">
                      <Link href={`/app/dossiers/${d.id}`} className="hover:underline">
                        {d.internalNumber}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">{d.importerName}</CardDescription>
                  </div>
                  <DossierStatusBadge status={d.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-foreground">{d.brand}</span>
                  <p className="text-muted-foreground">{d.productName}</p>
                </div>
                <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/60">
                  <span>Lote: {d.batchNumber ?? "—"}</span>
                  <span>Origem: {d.countryOrigin ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>
                    Score:{" "}
                    <strong>{d.complianceScore != null ? `${d.complianceScore} pts` : "—"}</strong>
                  </span>
                  {d.criticalAlerts > 0 ? (
                    <Badge variant="critical" className="gap-1 text-[11px]">
                      <ShieldAlert className="h-3 w-3" /> {d.criticalAlerts} blocker(s)
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0 blockers</span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center pt-2 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(d.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link href={`/app/dossiers/${d.id}`}>
                    Abrir dossiê <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
