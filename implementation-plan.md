# RegulaDoc AI — Plano de Implementação do MVP

## Contexto

Construir do zero (diretório vazio, sem git) um SaaS B2B de validação documental regulatória para importação de vinhos ("RegulaDoc AI"). O objetivo é um sistema de apoio à decisão — não substitui o analista — que recebe documentos de um dossiê de importação, simula extração de campos, roda um motor de regras determinístico (lote, marca, indicação geográfica, cálculo de volume, erro caixa×garrafa, laudo, etc.), gera alertas com severidade, permite revisão humana, calcula um score de conformidade e produz um parecer/relatório, tudo com trilha de auditoria e arquitetura pronta para multi-tenant.

Decisões já validadas com o usuário:
- **Local-first, zero-config**: Prisma + SQLite (sem Supabase real, sem chaves obrigatórias). Auth própria via NextAuth (Credentials provider) + cookies de sessão. Isolamento multi-tenant simulado via `organizationId` em toda query (uma camada de "RLS aplicativa"), documentado em SECURITY.md como o que seria migrado para Supabase Postgres + RLS nativo na Fase 2.
- **npm** como gerenciador de pacotes.
- IA/OCR: camada de adapters com `MockExtractionAdapter` ativo por padrão; placeholders (não implementados de fato) para Google Document AI / Vision / Gemini / OpenAI / Anthropic, selecionáveis por env var, com banner "modo simulado" na UI quando não há chave configurada (o que será sempre, no MVP).

Escopo pragmático: o prompt original lista uma quantidade de telas/campos maior do que é viável entregar com profundidade total em uma única sessão. Vou garantir 100% dos **Critérios de Aceitação (seção 16)** e da lógica de negócio pura (seção 11/14 - cálculo de volume, erro caixa×garrafa, normalização, comparação de marca, score) com testes unitários, e cobrir todas as páginas/módulos exigidos com profundidade funcional real (não apenas mockup visual), mas alguns extras "nice-to-have" (XLSX upload, exportação PDF avançada, DOCX parsing, e-mail) ficam com implementação simplificada e documentados no roadmap Fase 2/3 do README, exatamente como o prompt permite ("Exportar PDF" simples via `window.print`, adapters de IA como placeholders).

---

## Stack e principais dependências

- Next.js 14 (App Router) + TypeScript, Tailwind CSS, shadcn/ui, lucide-react, recharts, react-hook-form + zod, TanStack Table, Framer Motion.
- Prisma + SQLite (`file:./dev.db`), schema modelado com `organizationId` em todas as tabelas de domínio, `deletedAt` para soft delete.
- NextAuth (Credentials) para login com sessão em cookie; papéis `admin | gestor | analista` em `OrganizationMember`.
- Vitest para regras puras; Playwright para E2E.
- ESLint + Prettier.

---

## Estrutura de pastas (alto nível)

```
/prisma/schema.prisma, /prisma/seed.ts
/src/app/(auth)/login, /onboarding
/src/app/app/... (dashboard, dossiers, rules, regulatory-monitor, reports, settings, security, admin)
/src/app/api/... (rotas REST espelhando as server actions quando fizer sentido; a maior parte da mutação usa Server Actions)
/src/components/... (ui/ do shadcn, layout/ sidebar+topbar, dossiers/, documents/, alerts/, rules/, regulatory/, audit/, reports/, charts/)
/src/lib/
  auth.ts (NextAuth config)
  prisma.ts (client singleton)
  tenant.ts (helper withOrg(session) para escopo multi-tenant)
  rules/ (engine.ts, definitions.ts, calculations.ts — funções puras)
  extraction/ (adapters: mock, google-document-ai (placeholder), vision-ocr (placeholder), llm (placeholder), service.ts)
  llm/ (assistant.ts — mock LLMService para o "Assistente de Auditoria")
  audit.ts (helper logEvent)
/src/server/actions/ (server actions: dossiers, documents, validation, alerts, rules, regulatory, reports)
/tests/unit/*.test.ts (Vitest)
/tests/e2e/*.spec.ts (Playwright)
README.md, ARCHITECTURE.md, RULES.md, SECURITY.md, implementation-plan.md (cópia deste plano), .env.example
```

---

## Modelo de dados (Prisma, resumo)

Tabelas fiéis à seção 8 do prompt, adaptadas a SQLite/Prisma (camelCase, cuid ids):
`Organization, Profile(User), OrganizationMember, Dossier, Document, ExtractedField, ValidationRule, ValidationRun, ValidationAlert, RegulatorySource, RegulatoryItem, AuditEvent, Report`.

Pontos-chave:
- `Dossier.status`: enum (rascunho, documentos_pendentes, processando, em_revisao, aprovado, aprovado_com_ressalvas, reprovado, arquivado).
- `ValidationAlert.severity`: enum (critica, alta, media, baixa, informativa).
- `ValidationRule.version` incrementa a cada edição de metadados; `ValidationRun.rulesVersionSnapshot` (JSON) grava as versões usadas.
- Todas as tabelas de domínio carregam `organizationId`; todo acesso passa por um helper `lib/tenant.ts` que injeta o filtro — a "RLS aplicativa" documentada em SECURITY.md.
- `AuditEvent` genérico (action, entityType, entityId, beforeJson, afterJson) para todos os eventos da seção 7.9.

---

## Motor de regras (`src/lib/rules/`)

`calculations.ts` — funções puras testadas (Vitest):
- `calculateTotalVolume(packages, unitsPerPackage, unitCapacityLiters)`
- `normalizeText(value)`
- `compareNormalized(a, b)`
- `compareBrand(a, b, context)` → trata safra como complemento equivalente
- `detectBoxBottleMistake(packages, unitsPerPackage, unitCapacity, informedTotal)`
- `scoreDossier(alerts)` → aplica pesos por severidade (crítica -30, alta -15, média -7, baixa -3, informativa 0), floor em 0, classifica apto/apto com ressalvas/pendente/não recomendado.

`definitions.ts` — as 15 regras (códigos RULE-001..015) como objetos de metadados + função `evaluate(fields, documents) => AlertDraft[]`.

`engine.ts` — orquestra: recebe dossiê + documentos + campos extraídos, roda cada regra ativa, grava `ValidationRun` + `ValidationAlert[]`, retorna score.

---

## Extração mock (`src/lib/extraction/`)

`DocumentExtractionAdapter` interface com `extract(document, context): Promise<ExtractedFields>`. `MockExtractionAdapter` gera campos plausíveis por `documentType`, usando os dados do dossiê como base (para o dossiê "com erro" da seed, o mock já embute os erros de marca/volume/laudo ausente descritos na seção 12). Placeholders (`google-document-ai.ts`, `vision-ocr.ts`, `llm-extraction.ts`) só exportam a classe com `extract()` lançando "não configurado — usando mock" e um comentário apontando onde plugar a API real; `service.ts` escolhe o adapter por env var (`EXTRACTION_PROVIDER`), default mock, e expõe `isSimulated: boolean` para a UI mostrar o badge "Modo simulado".

---

## Fases de execução (seguindo a ordem pedida no prompt, sem pular)

1. **Setup**: `create-next-app` (TS, App Router, Tailwind), instalar deps, configurar shadcn/ui, ESLint/Prettier, `.env.example`, Prisma init com SQLite.
2. **Modelo de dados**: schema.prisma completo, `prisma migrate dev`, `prisma/seed.ts` com organização demo, 3 usuários (admin/gestor/analista @demo.com), dossiê DEMO-IMP-0001 (correto, 6 documentos) e DEMO-IMP-0002 (com os 3 erros da seção 12), regras 001-015 seedadas versão 1.
3. **UI base**: design system (tema compliance/enterprise — paleta neutra + azul-petróleo/verde para status, tipografia densa), layout `app/(app)/layout.tsx` com sidebar fixa + topbar (busca global, notificações, avatar), componentes reutilizáveis de tabela/cards/tags de status/empty states/loading states.
4. **Auth + Dashboard**: `/login`, `/onboarding`, NextAuth credentials contra `Profile`, dashboard executivo com KPIs, gráficos recharts (alertas por severidade, dossiês por status), lista de dossiês recentes, painel de publicações regulatórias novas.
5. **Dossiês e documentos**: CRUD de dossiê (`/app/dossiers`, `/new`, `/[id]` com abas), uploader drag-and-drop (salva arquivo em `/public/uploads` ou pasta local + metadados no banco), classificação por tipo documental, botão "Extrair campos" chamando o serviço mock.
6. **Motor de regras**: implementar `calculations.ts` + testes Vitest primeiro (TDD para a lógica crítica), depois `engine.ts`, tela de validações/alertas (lista + filtros + kanban por severidade), painel de revisão humana (`/app/dossiers/[id]/review`) com confirmar/rejeitar/falso-positivo/justificativa/reatribuir severidade.
7. **Revisão e relatório**: parecer de conformidade (`/app/dossiers/[id]` aba Relatório e `/app/reports`) com score, classificação, botão "Exportar PDF" via `window.print` com CSS de impressão dedicado; timeline de auditoria (ícones por tipo de evento).
8. **Monitor regulatório**: `/app/regulatory-monitor` — fontes seedadas (MAPA, DOU/Imprensa Nacional, Planalto, Receita Federal, Portal Único Siscomex, ANVISA + cadastro manual), botão "Simular verificação" que gera `RegulatoryItem` fake com resumo/impacto de IA mock, fluxo de aprovação → "Converter em regra" (cria/versiona uma `ValidationRule`).
9. **Editor de regras**: `/app/rules` — tabela + drawer de detalhe, ativar/desativar, criar nova versão (metadados), simulação contra o dossiê seed (roda `engine.ts` em modo dry-run mostrando resultado sem persistir).
10. **Segurança e SaaS**: `/app/security` (status da RLS aplicativa, retenção, provedores de IA configurados, modo simulado/produção, aviso de supervisão humana obrigatória), `/app/settings` (dados da organização, plano placeholder Starter/Professional/Enterprise, retenção de documentos), `/app/admin` (lista de organizações/usuários — visão simplificada), Assistente de Auditoria (chat lateral mock com perguntas sugeridas) dentro do dossiê.
11. **Testes e verificação**: rodar Vitest (regras) e Playwright (fluxo login→dashboard→criar dossiê→upload→validar→ver alertas→revisar→relatório), corrigir erros, abrir a app localmente e conferir visualmente as telas principais.
12. **Documentação final**: `README.md`, `ARCHITECTURE.md`, `RULES.md`, `SECURITY.md`, checklist de funcionalidades concluídas (pode ir no fim do README).

---

## Arquivos/rotas obrigatórios (mapeamento da seção 9)

`/login`, `/onboarding`, `/app` (dashboard), `/app/dossiers`, `/app/dossiers/new`, `/app/dossiers/[id]` (abas: Visão geral, Documentos, Campos extraídos, Validações, Alertas, Assistente, Auditoria, Relatório), `/app/dossiers/[id]/review`, `/app/rules`, `/app/regulatory-monitor`, `/app/reports`, `/app/settings`, `/app/security`, `/app/admin`.

APIs/Server Actions cobrindo a seção 13 (dossiers CRUD, documents upload/extract, dossiers/:id/validate, alerts review, rules CRUD, regulatory-sources + check + convert-to-rule, dossiers/:id/report, audit-events) — implementadas majoritariamente como Server Actions chamadas pelos componentes client, com um punhado de Route Handlers (`/api/...`) onde o prompt pede endpoint explícito (upload de arquivo, por exemplo, que precisa de `multipart/form-data`).

---

## Testes

**Vitest** (`tests/unit/`): cálculo de volume, detecção caixa×garrafa, normalização de texto, comparação de marca com safra, cálculo de score, validação de lote consistente, documento obrigatório ausente.

**Playwright** (`tests/e2e/`): login → dashboard → criar dossiê → upload simulado → executar validação → ver alertas → revisar alerta → gerar relatório, usando os dados seed.

---

## Verificação

1. `npm install`
2. `npm run db:seed` (migrate + seed)
3. `npm run dev` — abrir `http://localhost:3000`, logar com `analista@demo.com` (senha definida no seed/README), navegar: dashboard → dossiê DEMO-IMP-0001 (deve mostrar validação limpa) → dossiê DEMO-IMP-0002 (deve mostrar alertas críticos de volume, marca e laudo ausente com os números exatos do prompt: 675L vs 4.050L, Quinta das Carvalhas vs Carvalhas).
4. `npm run test` (Vitest) — todas as regras puras passam.
5. `npm run test:e2e` (Playwright) — fluxo completo passa.
6. Revisão visual manual das telas principais (dashboard, lista de dossiês, detalhe do dossiê com todas as abas, editor de regras, monitor regulatório, relatório, segurança).

---

## Entregáveis finais

Código funcional + `README.md` (instalação, env vars, seed, testes, arquitetura, limitações, próximos passos Fase 2/3) + `ARCHITECTURE.md` + `RULES.md` + `SECURITY.md` + testes passando + checklist final de funcionalidades no README.
