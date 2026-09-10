"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox, Plus, Radar } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RegulatoryItemStatusBadge } from "@/components/domain/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ALERT_SEVERITIES,
  REGULATORY_PUBLICATION_TYPE_LABELS,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  SEVERITY_LABELS,
  type RegulatoryPublicationType,
  type RuleCategory,
} from "@/lib/constants";
import {
  addManualRegulatorySource,
  convertRegulatoryItemToRule,
  simulateSourceCheck,
  updateRegulatoryItemStatus,
} from "@/server/actions/regulatory";

export interface SourceRow {
  id: string;
  organizationId: string | null;
  name: string;
  url: string;
  authority: string;
  sourceType: string;
  checkFrequency: string;
  lastCheckedAt: Date | null;
  status: string;
  _count: { items: number };
}

export interface ItemRow {
  id: string;
  organizationId: string | null;
  sourceId: string;
  title: string;
  authority: string;
  publicationType: string;
  url: string;
  publishedAt: Date;
  capturedAt: Date;
  status: string;
  summary: string | null;
  aiImpact: string | null;
  reviewerId: string | null;
  linkedRuleId: string | null;
  source: { name: string };
}

const CHECK_FREQUENCY_LABELS: Record<string, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  manual: "Manual",
};

const sourceFormSchema = z.object({
  name: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  url: z.string().url("Informe uma URL válida."),
  authority: z.string().min(2, "Informe a autoridade responsável."),
});
type SourceFormValues = z.infer<typeof sourceFormSchema>;

const convertFormSchema = z.object({
  category: z.enum(RULE_CATEGORIES),
  severity: z.enum(ALERT_SEVERITIES),
  ruleName: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  ruleDescription: z.string().min(10, "Descreva a regra com mais detalhes."),
  errorMessage: z.string().min(5, "Informe a mensagem de erro exibida ao usuário."),
});
type ConvertFormValues = z.infer<typeof convertFormSchema>;

/** diária = 24h, semanal = 7 dias; "manual" nunca entra na checagem automática. */
const CHECK_FREQUENCY_MS: Record<string, number> = {
  diaria: 24 * 60 * 60 * 1000,
  semanal: 7 * 24 * 60 * 60 * 1000,
};

function isSourceDue(source: SourceRow): boolean {
  const intervalMs = CHECK_FREQUENCY_MS[source.checkFrequency];
  if (!intervalMs) return false; // manual — só verificação sob demanda
  if (source.status !== "ativa") return false;
  if (!source.lastCheckedAt) return true;
  return Date.now() - new Date(source.lastCheckedAt).getTime() >= intervalMs;
}

export function RegulatoryMonitorClient({
  sources,
  items,
  currentUserId,
}: {
  sources: SourceRow[];
  items: ItemRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [simulatingSourceId, setSimulatingSourceId] = useState<string | null>(null);
  const [autoChecking, setAutoChecking] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasAutoChecked = useRef(false);

  const sourceForm = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: { name: "", url: "", authority: "" },
  });

  // Verificação automática: ao abrir a página, fontes vencidas (segundo sua
  // frequência configurada) são checadas sozinhas, sem precisar clicar em
  // "Simular verificação" — um cron leve rodando enquanto alguém está com a
  // página aberta, já que este MVP não tem um worker em segundo plano.
  useEffect(() => {
    if (hasAutoChecked.current) return;
    hasAutoChecked.current = true;

    const dueSources = sources.filter(isSourceDue);
    if (dueSources.length === 0) return;

    let cancelled = false;
    (async () => {
      setAutoChecking(true);
      let newItemsFound = 0;
      for (const source of dueSources) {
        if (cancelled) break;
        try {
          const result = await simulateSourceCheck(source.id);
          if (result.success && result.newItemCreated) newItemsFound += 1;
        } catch {
          // segue para a próxima fonte — uma falha isolada não deve travar o restante
        }
      }
      if (!cancelled) {
        setAutoChecking(false);
        toast.info(
          newItemsFound > 0
            ? `Verificação automática: ${dueSources.length} fonte(s) checada(s), ${newItemsFound} nova(s) publicação(ões).`
            : `Verificação automática concluída em ${dueSources.length} fonte(s) — nenhuma novidade.`,
        );
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma única vez por montagem, com base nos dados iniciais do servidor
  }, []);

  function handleSimulateCheck(sourceId: string) {
    setSimulatingSourceId(sourceId);
    simulateSourceCheck(sourceId)
      .then((result) => {
        if (result.success) {
          toast.success(
            result.newItemCreated
              ? "Verificação concluída: nova publicação encontrada."
              : "Verificação concluída — nenhuma novidade desta vez.",
          );
          router.refresh();
        } else {
          toast.error(result.error);
        }
      })
      .catch(() => toast.error("Erro ao simular verificação da fonte."))
      .finally(() => setSimulatingSourceId(null));
  }

  function onSubmitSource(values: SourceFormValues) {
    startTransition(async () => {
      const result = await addManualRegulatorySource(values);
      if (result.success) {
        toast.success("Fonte regulatória adicionada.");
        sourceForm.reset();
        setAddSourceOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleStatusUpdate(itemId: string, status: "em_analise" | "aprovado" | "rejeitado") {
    startTransition(async () => {
      const result = await updateRegulatoryItemStatus(itemId, status, currentUserId);
      if (result.success) {
        toast.success("Status do item atualizado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      {autoChecking && (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Verificando automaticamente fontes desatualizadas em segundo plano…
        </div>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Fontes monitoradas</h2>
          <Dialog open={addSourceOpen} onOpenChange={setAddSourceOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
                Adicionar fonte manual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar fonte regulatória manual</DialogTitle>
                <DialogDescription>
                  Use para acompanhar fontes específicas que não fazem parte do catálogo oficial monitorado
                  automaticamente.
                </DialogDescription>
              </DialogHeader>
              <Form {...sourceForm}>
                <form onSubmit={sourceForm.handleSubmit(onSubmitSource)} className="space-y-3">
                  <FormField
                    control={sourceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da fonte</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex.: Boletim da Câmara de Comércio Exterior" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sourceForm.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sourceForm.control}
                    name="authority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Autoridade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex.: MAPA, ANVISA, Receita Federal…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Adicionando…" : "Adicionar fonte"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {sources.length === 0 ? (
          <EmptyState icon={Radar} title="Nenhuma fonte cadastrada" description="Adicione uma fonte manual para começar a monitorar publicações." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <Card key={source.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{source.name}</CardTitle>
                      <CardDescription>{source.authority}</CardDescription>
                    </div>
                    <Badge variant={source.status === "ativa" ? "success" : "neutral"}>
                      {source.status === "ativa" ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>Frequência: {CHECK_FREQUENCY_LABELS[source.checkFrequency] ?? source.checkFrequency}</p>
                  <p>
                    Última verificação:{" "}
                    {source.lastCheckedAt
                      ? formatDistanceToNow(source.lastCheckedAt, { addSuffix: true, locale: ptBR })
                      : "Nunca verificada"}
                  </p>
                  <p>{source._count.items} publicação(ões) capturada(s)</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={simulatingSourceId === source.id}
                    onClick={() => handleSimulateCheck(source.id)}
                  >
                    {simulatingSourceId === source.id ? "Sincronizando…" : "Verificar fonte agora"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Fila de publicações normativas</h2>
        {items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma publicação capturada ainda"
            description="Sincronize uma das fontes oficiais acima para consultar publicações normativas."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.authority} ·{" "}
                        {REGULATORY_PUBLICATION_TYPE_LABELS[item.publicationType as RegulatoryPublicationType] ??
                          item.publicationType}{" "}
                        · Publicado em {format(item.publishedAt, "dd/MM/yyyy", { locale: ptBR })} · Fonte: {item.source.name}
                      </p>
                    </div>
                    <RegulatoryItemStatusBadge status={item.status} />
                  </div>

                  {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}

                  {item.aiImpact && (
                    <Alert className="border-severity-low/30 bg-severity-low/10">
                      <AlertTitle className="text-xs">Impacto avaliado por IA</AlertTitle>
                      <AlertDescription className="text-xs">{item.aiImpact}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {item.status === "novo" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleStatusUpdate(item.id, "em_analise")}
                      >
                        Marcar em análise
                      </Button>
                    )}
                    {(item.status === "novo" || item.status === "em_analise") && (
                      <>
                        <Button size="sm" disabled={isPending} onClick={() => handleStatusUpdate(item.id, "aprovado")}>
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleStatusUpdate(item.id, "rejeitado")}
                        >
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {item.status === "aprovado" && <ConvertToRuleDialog itemId={item.id} defaultName={item.title} />}
                    {item.status === "convertido_em_regra" && (
                      <p className="text-xs text-muted-foreground">Já convertido em regra de validação.</p>
                    )}
                    {item.status === "rejeitado" && (
                      <p className="text-xs text-muted-foreground">Item rejeitado — nenhuma ação adicional necessária.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ConvertToRuleDialog({ itemId, defaultName }: { itemId: string; defaultName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ConvertFormValues>({
    resolver: zodResolver(convertFormSchema),
    defaultValues: {
      category: "documentacao",
      severity: "media",
      ruleName: defaultName,
      ruleDescription: "",
      errorMessage: "",
    },
  });

  function onSubmit(values: ConvertFormValues) {
    startTransition(async () => {
      const result = await convertRegulatoryItemToRule({ itemId, ...values });
      if (result.success) {
        toast.success("Item convertido em nova regra de validação.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Converter em regra</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Converter em regra de validação</DialogTitle>
          <DialogDescription>
            A nova regra entra imediatamente ativa e passa a ser avaliada nas próximas execuções do motor de regras.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="ruleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da regra</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ruleDescription"
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RULE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {RULE_CATEGORY_LABELS[category as RuleCategory]}
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
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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
            </div>
            <FormField
              control={form.control}
              name="errorMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem de erro</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Criar regra"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
