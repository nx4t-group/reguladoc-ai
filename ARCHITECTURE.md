# Arquitetura — RegulaDoc AI

## Diagrama lógico

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router — RSC + Client Components)                  │
│  /login  /onboarding  /app/(dashboard, dossiers, rules, regulatory-      │
│  monitor, reports, settings, security, admin)                            │
└───────────────┬────────────────────────────────────────────────────────-┘
                 │ Server Actions ("use server") + Route Handlers
                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Camada de aplicação (src/lib, src/server/actions)                       │
│                                                                            │
│  tenant.ts ── requireTenant()/requireRole()  ("RLS aplicativa")          │
│  audit.ts  ── logAuditEvent()                                            │
│                                                                            │
│  rules/                      extraction/                 llm/           │
│  ├─ calculations.ts (puro)   ├─ types.ts                  └─ assistant.ts│
│  ├─ definitions.ts (15 regras)├─ mock-adapter.ts (mock)                  │
│  └─ engine.ts (orquestra)    ├─ placeholder-adapters.ts (Google/LLM)     │
│                               └─ service.ts (seleciona por env var)      │
└───────────────┬────────────────────────────────────────────────────────-┘
                 │ Prisma Client
                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  SQLite (dev.db) — schema multi-tenant (organizationId em toda tabela)   │
│  Organization, Profile, OrganizationMember, Dossier, Document,           │
│  ExtractedField, ValidationRule, ValidationRun, ValidationAlert,         │
│  RegulatorySource, RegulatoryItem, AuditEvent, Report                    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Módulos

### `src/lib/rules` — motor de validação

- **`calculations.ts`** — funções puras e testáveis, sem dependência de banco ou React: `calculateTotalVolume`, `normalizeText`, `compareNormalized`, `compareBrand` (trata safra como complemento equivalente, mas nunca trata uma marca que é substring de outra como equivalente — ver `RULES.md`), `detectBoxBottleMistake`, `validateBatchConsistency`, `validateLabReportPresence`, `validateGeographicalIndication`, `validateProducerConsistency`, `scoreDossier`.
- **`definitions.ts`** — o catálogo das 15 regras (`RULE_DEFINITIONS`), cada uma com metadados (categoria, severidade padrão, fonte normativa/interna, mensagem de erro, sugestão) e uma função `evaluate(ctx)` que usa as funções de `calculations.ts`.
- **`engine.ts`** — `runRuleEngine({ dossier, documents, rules? })` roda todas as regras (ou um subconjunto, usado pelo simulador do editor de regras) contra os campos extraídos dos documentos de um dossiê e retorna `{ findings, score, rulesVersionSnapshot }`.

Este desenho separa deliberadamente "o que é uma regra" (metadados + lógica, em código, versionado no Git) de "quais regras estão ativas para este tenant" (linhas na tabela `ValidationRule`, com `status`/`version`). Rodar uma validação real (`src/server/actions/validation.ts`) busca as regras ativas no banco, filtra `RULE_DEFINITIONS` pelos códigos correspondentes, roda o engine e grava `ValidationRun` + `ValidationAlert[]`, sempre com um snapshot JSON de `{ code, version }` de cada regra usada — isso é o que a seção de compliance chama de "toda validação registra a versão da regra aplicada" (RULE-015).

### `src/lib/extraction` — camada de adapters de IA/OCR

Interface única (`DocumentExtractionAdapter.extract(input): Promise<ExtractedFieldValue[]>`) com:

- **`MockExtractionAdapter`** (ativo por padrão, sempre disponível como fallback) — gera campos plausíveis a partir dos dados já cadastrados no dossiê (marca, produtor, lote, volume etc.), especializados por tipo de documento (Anexo IX pede número de laudo, laudo de análise pede parâmetros físico-químicos, rótulo pede cor/uva/teor de açúcar...). Aceita `fieldOverrides` para simular divergências reais entre documentos (usado no seed para o dossiê "com erro").
- **`GeminiExtractionAdapter`** (`gemini-adapter.ts`) — **adapter real e funcional**, não um placeholder: com `GEMINI_API_KEY` configurada, lê o arquivo original (via `readStoredFile()`, local ou Vercel Blob), envia como `inlineData` multimodal para a API do Google Gemini (`gemini-flash-latest` — alias mantido pelo Google apontando para o modelo flash atual, escolhido deliberadamente em vez de fixar uma versão como `gemini-1.5-flash`, que foi descontinuada) junto com um prompt específico por tipo de documento e um `responseSchema` JSON estruturado, e faz parse da resposta em `ExtractedFieldValue[]`. Qualquer erro (rede, parsing, arquivo ausente) cai de volta no mock automaticamente — nunca quebra o fluxo de upload.
- **`GoogleDocumentAIAdapter`, `VisionOCRAdapter`, `LLMExtractionAdapter`** — ainda placeholders que apenas delegam para o mock e retornam `isSimulated: true`; cada um documenta no código onde plugar a chamada real (Fase 2).
- **`service.ts`** — `getExtractionAdapter()` escolhe o adapter pela env var `EXTRACTION_PROVIDER` (padrão `mock`; use `gemini` para OCR real).

A UI (aba Documentos do dossiê, dashboard, Segurança) lê `isExtractionSimulated()` e mostra o badge **"Modo simulado"** sempre que não há provedor real configurado, ou o badge de provedor ativo (ex. "Gemini OCR Ativo") quando há.

### `src/lib/storage.ts` — armazenamento de documentos

Abstrai onde o arquivo enviado fica salvo, resolvido automaticamente por variável de ambiente — sem precisar trocar código nas server actions:

- **Local (padrão)** — disco em `storage/uploads/<organizationId>/<dossierId>/`, usado sempre que `BLOB_READ_WRITE_TOKEN` não está definido (desenvolvimento).
- **Vercel Blob** — usado automaticamente quando `BLOB_READ_WRITE_TOKEN` está presente (produção na Vercel); necessário porque hospedagem serverless não mantém filesystem persistente entre execuções.

`readStoredFile(filePath)` complementa isso do lado da leitura: detecta se `filePath` é uma URL (Blob) ou um caminho relativo (disco) e lê de onde for preciso — é o que o `GeminiExtractionAdapter` usa para pegar o arquivo original antes de enviar para a API.

### `src/lib/llm/assistant.ts` — Assistente de Auditoria

Não é um LLM de verdade: `LLMAssistantService.ask(question, dossierSnapshot)` faz correspondência de palavras-chave na pergunta (faltando, crítica, apto, marca, regra) e monta uma resposta a partir dos dados reais do dossiê (alertas, documentos faltantes, score). Isso evita alucinação total no MVP e deixa a interface (`src/app/app/dossiers/[id]/assistant-tab.tsx`) pronta para trocar a implementação por uma chamada real com RAG sobre os documentos do dossiê, sem mudar o contrato (`ask(question, snapshot): Promise<string>`).

### `src/lib/tenant.ts` — isolamento multi-tenant

`requireTenant()` resolve a sessão NextAuth (`getServerSession`) e devolve `{ userId, organizationId, role, ... }`, redirecionando para `/login` se não autenticado. `requireRole(allowed)` faz o mesmo e redireciona para `/app` se o papel não for permitido. **Toda** página server component sob `/app/**` e **toda** server action chama uma dessas funções como primeira linha, e todo `where`/`data` do Prisma é filtrado por `organizationId` resolvido daí — nunca por um valor vindo do cliente. Ver `SECURITY.md` para a discussão de por que isso substitui RLS nativo neste MVP em SQLite.

### `src/lib/audit.ts` — trilha de auditoria

`logAuditEvent()` grava uma linha em `AuditEvent` (ação, tipo/id da entidade, before/after em JSON, usuário, dossiê). Chamado por toda server action que cria, altera ou avalia uma entidade do domínio. A aba "Auditoria" do dossiê (`audit-tab.tsx`) renderiza esses eventos como uma timeline vertical com ícone por tipo de ação.

## Fluxo de validação (fim a fim)

1. Analista cria o dossiê (`createDossier`) e envia um documento (`uploadDocument`, salvo via `saveUploadedFile` — local ou Vercel Blob).
2. **Automação**: a própria `uploadDocument` já chama `extractDocumentFields` (grava `ExtractedField[]` via o adapter ativo) e em seguida `runDossierValidation` para o dossiê inteiro, antes mesmo de retornar — o analista não precisa clicar em nada para ver o resultado de um upload. Os botões manuais "Executar validação"/"Revalidar" e "Extrair campos"/"Reprocessar" continuam disponíveis para re-rodar depois de uma correção.
3. `runDossierValidation` monta `DocumentFieldSet[]` (tipo de documento + mapa de campos) a partir do banco, busca as `ValidationRule` ativas do tenant, roda `runRuleEngine`, grava `ValidationRun` + um `ValidationAlert` por achado, e atualiza `dossier.complianceScore` e `dossier.status` (→ `em_revisao`, a menos que o dossiê já esteja em um estado final).
4. **Automação**: se essa validação não encontrar nenhum achado de RULE-013 (documento obrigatório ausente) — ou seja, a documentação já está completa — e o dossiê ainda não tem uma decisão final, um `Report` é gerado automaticamente para aquela execução (mesmo texto/formato do botão manual "Gerar parecer"). Isso evita gerar um parecer a cada upload individual de um dossiê ainda incompleto, mas garante que o parecer já exista assim que a documentação estiver completa e validada.
5. Analista revisa cada alerta na tela de revisão focada (`reviewAlert` — confirmar/rejeitar/falso positivo/resolver, com comentário e possível reatribuição de severidade). Cada revisão recalcula o score considerando apenas alertas ainda `aberto`/`confirmado` (`recomputeDossierScore`).
6. `decideDossier` (RULE-014 — só `gestor`/`admin`) aprova, aprova com ressalvas ou reprova o dossiê — bloqueado se houver alerta crítico ainda `aberto`/`confirmado`. Essa é a única forma de um dossiê chegar a um status final: nunca automático.

## Fluxo de monitoramento regulatório

1. Fontes regulatórias (`RegulatorySource`) são cadastradas — seis globais (seed: MAPA, DOU/Imprensa Nacional, Planalto, Receita Federal, Portal Único Siscomex, ANVISA) mais fontes manuais por organização.
2. `simulateSourceCheck` simula uma nova verificação, atualizando `lastCheckedAt` e (probabilisticamente) criando um novo `RegulatoryItem` com resumo e impacto sugerido — texto determinístico escolhido de um conjunto de templates plausíveis, não geração livre. **Automação**: ao abrir `/app/regulatory-monitor`, um efeito no client component (`regulatory-monitor-client.tsx`) verifica quais fontes já estão "vencidas" segundo sua `checkFrequency` (diária = 24h, semanal = 7 dias; fontes `manual` nunca entram nessa checagem automática) e chama `simulateSourceCheck` para cada uma sozinho — como este MVP não tem um worker/cron em segundo plano, essa é uma verificação "sob demanda" que roda toda vez que alguém está com a página aberta, não um cron de servidor de verdade.
3. Um especialista aprova ou rejeita o item (`updateRegulatoryItemStatus`).
4. Um item aprovado pode ser convertido em regra (`convertRegulatoryItemToRule`) — isso cria uma **nova** `ValidationRule` (nunca sobrescreve uma regra ativa automaticamente) com `sourceType: "normativa"` e `sourceReference` apontando para a URL da publicação.
5. Validações futuras já rodam com a nova regra ativa e registram sua versão no `rulesVersionSnapshot`.

Nenhuma publicação altera uma regra ativa sem essa aprovação humana explícita — é o mesmo princípio de supervisão humana obrigatória do RULE-014, aplicado ao ciclo de vida das regras.

## Decisões sobre mocks e adapters

| Área | Decisão no MVP | Por quê |
| --- | --- | --- |
| Banco de dados | SQLite local por padrão (dev); Postgres hospedado (Neon) em produção | Zero configuração em dev — `npm install && npm run db:seed && npm run dev` funciona sem criar conta em nenhum serviço externo. O schema já era modelado com `organizationId` em toda tabela de domínio desde o início, exatamente para essa migração ser só trocar o `provider` do datasource. |
| Auth | NextAuth v4 (Credentials + JWT), não Supabase Auth | Nenhuma chave/projeto externo necessário; funciona igual em dev e produção. |
| Storage de arquivos | Disco local em dev; Vercel Blob em produção (`src/lib/storage.ts`) | Hospedagem serverless não mantém disco persistente entre execuções — a abstração troca sozinha com base em `BLOB_READ_WRITE_TOKEN`. |
| OCR/extração | Mock por padrão; **Gemini real e funcional** via `EXTRACTION_PROVIDER=gemini` | O escopo original pedia que nenhuma chave fosse obrigatória — isso continua valendo (mock é o padrão). Google Gemini foi implementado como o primeiro adapter real porque lê PDF/imagem multimodal diretamente, sem precisar de um pipeline de OCR + LLM separado. |
| IA generativa (assistente) | Respostas determinísticas baseadas em dados reais, não um LLM real | Evita custo/latência/chave obrigatória no MVP e evita alucinação; a interface já está pronta para RAG real na Fase 2. |
| RLS | Aplicativa (código), não nativa do banco | Mesmo em produção com Postgres, o MVP mantém RLS aplicativa (`requireTenant()`/`requireRole()`) em vez de policies nativas — RLS nativo do Postgres é o próximo passo documentado em `SECURITY.md`, ainda não ativado. |

## Deploy em produção (Vercel)

O deploy publica a mesma base de código, trocando três coisas via variável de ambiente — nenhum código muda entre dev e produção:

1. **Banco**: `DATABASE_URL` aponta para um Postgres hospedado (Neon) em vez do arquivo SQLite local; `prisma/schema.prisma` tem seu `datasource.provider` trocado de `"sqlite"` para `"postgresql"`.
2. **Storage**: adicionar o storage "Blob" ao projeto na Vercel injeta `BLOB_READ_WRITE_TOKEN` automaticamente — `src/lib/storage.ts` passa a usar Vercel Blob sem qualquer mudança de código.
3. **OCR**: `EXTRACTION_PROVIDER=gemini` + `GEMINI_API_KEY` habilitam a extração real (já testada localmente).

Variáveis a configurar no painel do projeto Vercel: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (a URL pública do deploy), `EXTRACTION_PROVIDER`, `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN` (automático ao ativar o Blob).
