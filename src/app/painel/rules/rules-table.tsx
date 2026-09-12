"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { SeverityBadge } from "@/components/domain/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ALERT_SEVERITIES,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  SEVERITY_LABELS,
  type AlertSeverity,
  type RuleCategory,
} from "@/lib/constants";
import { createRuleVersion, simulateRuleAgainstDemoDossier, toggleRuleStatus } from "@/server/actions/rules";

export interface RuleRow {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  sourceType: string;
  sourceReference: string | null;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  errorMessage: string;
  suggestion: string | null;
}

const RULE_STATUS_LABELS: Record<string, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  rascunho: "Rascunho",
};

const RULE_STATUS_BADGE: Record<string, "success" | "neutral" | "warning"> = {
  ativa: "success",
  inativa: "neutral",
  rascunho: "warning",
};

const versionFormSchema = z.object({
  name: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  description: z.string().min(10, "Descreva a regra com mais detalhes."),
  severity: z.enum(ALERT_SEVERITIES),
  sourceReference: z.string().optional(),
  suggestion: z.string().optional(),
});
type VersionFormValues = z.infer<typeof versionFormSchema>;

type SimulateResult = Awaited<ReturnType<typeof simulateRuleAgainstDemoDossier>>;

export function RulesTable({ rules, hasDossierForSimulation }: { rules: RuleRow[]; hasDossierForSimulation: boolean }) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selected, setSelected] = useState<RuleRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const filtered = useMemo(() => {
    return rules.filter((rule) => {
      if (categoryFilter !== "todas" && rule.category !== categoryFilter) return false;
      if (statusFilter !== "todos" && rule.status !== statusFilter) return false;
      return true;
    });
  }, [rules, categoryFilter, statusFilter]);

  const history = useMemo(() => {
    if (!selected) return [];
    return rules.filter((rule) => rule.code === selected.code).sort((a, b) => b.version - a.version);
  }, [rules, selected]);

  const form = useForm<VersionFormValues>({
    resolver: zodResolver(versionFormSchema),
    defaultValues: { name: "", description: "", severity: "media", sourceReference: "", suggestion: "" },
  });

  useEffect(() => {
    if (selected) {
      form.reset({
        name: selected.name,
        description: selected.description,
        severity: selected.severity as AlertSeverity,
        sourceReference: selected.sourceReference ?? "",
        suggestion: selected.suggestion ?? "",
      });
    }
  }, [selected, form]);

  function openSheet(rule: RuleRow) {
    setSelected(rule);
    setSheetOpen(true);
    setSimResult(null);
  }

  function handleToggle() {
    if (!selected) return;
    startTransition(async () => {
      const result = await toggleRuleStatus(selected.id);
      if (result.success) {
        toast.success(`Regra ${result.status === "ativa" ? "ativada" : "desativada"} com sucesso.`);
        setSelected((prev) => (prev ? { ...prev, status: result.status } : prev));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onSubmitVersion(values: VersionFormValues) {
    if (!selected) return;
    startTransition(async () => {
      const result = await createRuleVersion({
        ruleId: selected.id,
        name: values.name,
        description: values.description,
        severity: values.severity,
        sourceReference: values.sourceReference || undefined,
        suggestion: values.suggestion || undefined,
      });
      if (result.success) {
        toast.success(`Nova versão da regra ${selected.code} criada.`);
        setSheetOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSimulate() {
    if (!selected) return;
    setSimLoading(true);
    setSimResult(null);
    simulateRuleAgainstDemoDossier(selected.code)
      .then((result) => setSimResult(result))
      .catch(() => toast.error("Erro ao simular a regra contra o dossiê de exemplo."))
      .finally(() => setSimLoading(false));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {RULE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {RULE_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="inativa">Inativa</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground">{filtered.length} regra(s)</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhuma regra encontrada</p>
            <p className="text-xs text-muted-foreground">Ajuste os filtros para ver outras regras do catálogo.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground py-3">Código</TableHead>
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Nome</TableHead>
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria</TableHead>
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Severidade</TableHead>
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Versão</TableHead>
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Fonte</TableHead>
                <TableHead className="text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rule) => (
                <TableRow key={rule.id} className="hover:bg-muted/25 transition-colors">
                  <TableCell className="py-3.5 whitespace-nowrap font-mono text-[13px] font-semibold text-primary">{rule.code}</TableCell>
                  <TableCell className="py-3.5 max-w-xs text-[14px] font-medium text-foreground">{rule.name}</TableCell>
                  <TableCell className="py-3.5 whitespace-nowrap text-[13px] text-muted-foreground">
                    {RULE_CATEGORY_LABELS[rule.category as RuleCategory] ?? rule.category}
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={rule.severity} />
                  </TableCell>
                  <TableCell>v{rule.version}</TableCell>
                  <TableCell>
                    <Badge variant={RULE_STATUS_BADGE[rule.status] ?? "neutral"}>
                      {RULE_STATUS_LABELS[rule.status] ?? rule.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {rule.organizationId ? "Organização" : "Global"} · {rule.sourceType === "normativa" ? "Normativa" : "Interna"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openSheet(rule)}>
                      Ver detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.code} — {selected.name}
                </SheetTitle>
                <SheetDescription>
                  Versão {selected.version} · {RULE_CATEGORY_LABELS[selected.category as RuleCategory] ?? selected.category}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={selected.severity} />
                  <Badge variant={RULE_STATUS_BADGE[selected.status] ?? "neutral"}>
                    {RULE_STATUS_LABELS[selected.status] ?? selected.status}
                  </Badge>
                  <Badge variant="outline">{selected.sourceType === "normativa" ? "Normativa" : "Interna"}</Badge>
                  <Badge variant="outline">{selected.organizationId ? "Organização" : "Global"}</Badge>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Descrição</h4>
                  <p className="text-muted-foreground">{selected.description}</p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">Mensagem de erro</h4>
                  <p className="text-muted-foreground">{selected.errorMessage}</p>
                </div>

                {selected.suggestion && (
                  <div>
                    <h4 className="font-medium text-foreground">Sugestão de correção</h4>
                    <p className="text-muted-foreground">{selected.suggestion}</p>
                  </div>
                )}

                {selected.sourceReference && (
                  <div>
                    <h4 className="font-medium text-foreground">Referência normativa</h4>
                    <p className="text-muted-foreground">{selected.sourceReference}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Vigente desde {format(selected.effectiveFrom, "dd/MM/yyyy", { locale: ptBR })}
                  {selected.effectiveTo && ` até ${format(selected.effectiveTo, "dd/MM/yyyy", { locale: ptBR })}`}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Status da regra</p>
                  <p className="text-xs text-muted-foreground">Regras inativas não são aplicadas nas próximas validações.</p>
                </div>
                <Button
                  variant={selected.status === "ativa" ? "outline" : "default"}
                  size="sm"
                  disabled={isPending}
                  onClick={handleToggle}
                >
                  {selected.status === "ativa" ? "Desativar" : "Ativar"}
                </Button>
              </div>

              <Separator className="my-4" />

              <div>
                <h4 className="mb-2 text-sm font-medium text-foreground">Criar nova versão</h4>
                {selected.status !== "ativa" ? (
                  <p className="text-xs text-muted-foreground">
                    Somente é possível criar uma nova versão a partir de uma regra ativa. Ative a regra ou abra a versão ativa
                    correspondente.
                  </p>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitVersion)} className="space-y-3">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                              <Textarea rows={3} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="severity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Severidade</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a severidade" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ALERT_SEVERITIES.map((severity) => (
                                  <SelectItem key={severity} value={severity}>
                                    {SEVERITY_LABELS[severity]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sourceReference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Referência normativa (opcional)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="suggestion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sugestão de correção (opcional)</FormLabel>
                            <FormControl>
                              <Textarea rows={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" size="sm" disabled={isPending}>
                        {isPending ? "Salvando…" : "Salvar nova versão"}
                      </Button>
                    </form>
                  </Form>
                )}
              </div>

              <Separator className="my-4" />

              <div>
                <h4 className="mb-2 text-sm font-medium text-foreground">Histórico de versões</h4>
                <ul className="space-y-1.5">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      <span>
                        v{h.version} — {format(h.effectiveFrom, "dd/MM/yyyy", { locale: ptBR })}
                        {h.effectiveTo ? ` a ${format(h.effectiveTo, "dd/MM/yyyy", { locale: ptBR })}` : ""}
                      </span>
                      <Badge variant={RULE_STATUS_BADGE[h.status] ?? "neutral"}>
                        {RULE_STATUS_LABELS[h.status] ?? h.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator className="my-4" />

              <div>
                <h4 className="mb-2 text-sm font-medium text-foreground">Simular contra dossiê de exemplo</h4>
                {!hasDossierForSimulation ? (
                  <p className="text-xs text-muted-foreground">Nenhum dossiê disponível nesta organização para simulação.</p>
                ) : (
                  <>
                    <Button variant="outline" size="sm" disabled={simLoading} onClick={handleSimulate}>
                      {simLoading ? "Simulando…" : "Simular contra dossiê de exemplo"}
                    </Button>
                    {simResult && (
                      <div className="mt-3 space-y-2">
                        {!simResult.success ? (
                          <p className="text-xs text-destructive">{simResult.error}</p>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground">Dossiê simulado: {simResult.dossierInternalNumber}</p>
                            {simResult.findings.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Nenhum achado desta regra neste dossiê de exemplo.
                              </p>
                            ) : (
                              simResult.findings.map((finding, idx) => (
                                <div key={idx} className="rounded-md border border-border p-2 text-xs">
                                  <p className="font-medium text-foreground">{finding.title}</p>
                                  <p className="mt-0.5 text-muted-foreground">{finding.message}</p>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
