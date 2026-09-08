"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, FileStack, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DossierStatusBadge } from "@/components/domain/status-badge";
import { DOSSIER_STATUSES, DOSSIER_STATUS_LABELS, type DossierStatus } from "@/lib/constants";

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
    header: "Número",
    cell: ({ row }) => (
      <Link href={`/app/dossiers/${row.original.id}`} className="font-medium text-foreground hover:underline">
        {row.original.internalNumber}
      </Link>
    ),
  },
  { accessorKey: "importerName", header: "Importador" },
  {
    accessorKey: "productName",
    header: "Produto",
    cell: ({ row }) => (
      <div>
        <p>{row.original.productName}</p>
        <p className="text-xs text-muted-foreground">{row.original.brand}</p>
      </div>
    ),
  },
  { accessorKey: "batchNumber", header: "Lote", cell: ({ row }) => row.original.batchNumber ?? "—" },
  { accessorKey: "countryOrigin", header: "País", cell: ({ row }) => row.original.countryOrigin ?? "—" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DossierStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "complianceScore",
    header: "Score",
    cell: ({ row }) => (row.original.complianceScore == null ? <span className="text-muted-foreground">—</span> : `${row.original.complianceScore}/100`),
  },
  {
    accessorKey: "criticalAlerts",
    header: "Críticos",
    cell: ({ row }) =>
      row.original.criticalAlerts > 0 ? (
        <Badge variant="critical" className="gap-1">
          <ShieldAlert className="h-3 w-3" /> {row.original.criticalAlerts}
        </Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  { accessorKey: "assignedToName", header: "Responsável", cell: ({ row }) => row.original.assignedToName ?? "—" },
  {
    accessorKey: "updatedAt",
    header: "Atualizado",
    cell: ({ row }) => format(new Date(row.original.updatedAt), "dd/MM/yyyy", { locale: ptBR }),
  },
];

export function DossiersTable({ data }: { data: DossierRow[] }) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("todos");
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "updatedAt", desc: true }]);

  const filtered = React.useMemo(
    () => (statusFilter === "todos" ? data : data.filter((d) => d.status === statusFilter)),
    [data, statusFilter],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const haystack = [row.original.internalNumber, row.original.importerName, row.original.brand, row.original.productName, row.original.batchNumber]
        .join(" ")
        .toLowerCase();
      return haystack.includes(String(filterValue).toLowerCase());
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por número, importador, marca, lote…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {DOSSIER_STATUSES.map((status: DossierStatus) => (
              <SelectItem key={status} value={status}>
                {DOSSIER_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        className="flex items-center gap-1 disabled:cursor-default"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileStack className="h-8 w-8" />
                    <p className="text-sm">Nenhum dossiê encontrado com esses filtros.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
