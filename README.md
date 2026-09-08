# RegulaDoc AI

Sistema de apoio à decisão para validação documental regulatória de processos de importação, com foco inicial em **vinhos importados no Brasil**. Não substitui o analista humano: gera parecer de conformidade com evidências, alertas classificados por severidade e trilha de auditoria completa, sempre exigindo revisão humana antes de qualquer aprovação final.

> Ver também: [ARCHITECTURE.md](./ARCHITECTURE.md) (arquitetura e decisões técnicas), [RULES.md](./RULES.md) (as 15 regras de validação), [SECURITY.md](./SECURITY.md) (LGPD, multi-tenancy, RLS).

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix UI) + lucide-react + recharts + react-hook-form + zod + TanStack Table + Framer Motion.
- **Backend**: Server Actions + Route Handlers, Prisma + **SQLite local** (zero configuração — sem necessidade de conta Supabase ou chaves de API para rodar o MVP).
- **Auth**: NextAuth v4 (Credentials + JWT), com papéis `admin | gestor | analista` por organização (`OrganizationMember`).
- **IA/OCR**: camada de adapters (`src/lib/extraction`, `src/lib/llm`) — roda em **modo simulado** por padrão, sem exigir nenhuma chave real.
- **Testes**: Vitest (regras de negócio puras) + Playwright (E2E).

## Instalação e execução local

Pré-requisitos: Node.js 20+.

```bash
npm install
cp .env.example .env      # já vem com valores padrão que funcionam localmente
npm run db:seed           # cria o banco SQLite, aplica migrations e popula dados de demonstração
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) — você será redirecionado para `/login`.

### Login de demonstração

O seed cria uma organização (**Comissária Brasil Demo**) com três usuários, todos com senha `demo1234`:

| E-mail | Papel |
| --- | --- |
| `admin@demo.com` | Admin SaaS |
| `gestor@demo.com` | Gestor da Comissária |
| `analista@demo.com` | Analista Regulatório |

E dois dossiês de demonstração:

- **DEMO-IMP-0001** — dossiê "limpo", já aprovado, score 100/100.
- **DEMO-IMP-0002** — dossiê com os três erros clássicos descritos no escopo do produto: erro caixa×garrafa no volume (900 caixas × 6 garrafas × 0,75 L informadas como 675 L em vez de 4.050 L), divergência de marca ("Quinta das Carvalhas" vs. "Carvalhas") e laudo ausente no Anexo IX.

### Variáveis de ambiente

Ver [.env.example](./.env.example) — todas têm valores padrão funcionais para rodar localmente. Nenhuma chave de IA/OCR é necessária: sem `EXTRACTION_PROVIDER`/`LLM_PROVIDER` configurados para um provedor real, o sistema usa adapters mock e exibe o aviso **"Modo simulado"** na interface (dashboard, aba Documentos, Assistente de Auditoria, página Segurança).

### Scripts npm

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento em `localhost:3000` |
| `npm run build` / `npm run start` | Build e execução em modo produção |
| `npm run lint` | ESLint |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:watch` | Vitest em modo watch |
| `npm run test:e2e` | Testes E2E (Playwright) — sobe o dev server automaticamente se não estiver rodando |
| `npm run db:migrate` | Cria/aplica uma nova migration Prisma |
| `npm run db:seed` | **Reseta** o banco (`prisma migrate reset --force`) e roda o seed novamente — use sempre que quiser voltar ao estado de demonstração |
| `npm run db:studio` | Abre o Prisma Studio para inspecionar os dados |

## Rodando os testes

```bash
npm run test        # 25 testes unitários: cálculo de volume, erro caixa×garrafa,
                     # normalização de texto, comparação de marca com safra, score,
                     # consistência de lote, documento obrigatório ausente, etc.

npm run test:e2e     # fluxo completo: login → dashboard → criar dossiê → upload →
                      # extração → validação → alertas → revisão → parecer
```

Os testes E2E usam o próprio banco de desenvolvimento (criam dossiês `E2E-*`); rode `npm run db:seed` depois para voltar ao estado limpo de demonstração.

> **Nota:** este projeto está em uma pasta sincronizada pelo OneDrive. A primeira compilação de cada rota em modo dev pode demorar bastante (10–20s) por causa do overhead de I/O do sincronizador — normal, não é bug. Se for usar o projeto no dia a dia, considere movê-lo para fora de uma pasta sincronizada (ex. `C:\dev\reguladoc-ai`) para uma experiência de dev bem mais rápida.

## Arquitetura em 1 minuto

- **Multi-tenant sem RLS nativo**: como o MVP roda em SQLite (não Postgres), o isolamento entre organizações é uma **"RLS aplicativa"** — todo acesso a dado passa por `requireTenant()`/`requireRole()` (`src/lib/tenant.ts`), que resolvem a sessão e garantem que todo `where`/`data` do Prisma seja filtrado por `organizationId`. Ver [SECURITY.md](./SECURITY.md) para o plano de migração para Supabase Postgres + RLS nativo.
- **Motor de regras determinístico** (`src/lib/rules/`): 15 regras versionadas (RULE-001 a RULE-015) rodam sobre os campos extraídos de cada documento e sobre os dados do dossiê, gerando alertas com severidade, evidência e sugestão de correção. Ver [RULES.md](./RULES.md).
- **Extração documental simulada** (`src/lib/extraction/`): interface `DocumentExtractionAdapter` com um `MockExtractionAdapter` funcional e placeholders para Google Document AI, Google Vision OCR e extração via LLM — nenhum deles chama uma API real neste MVP.
- **Assistente de Auditoria** (`src/lib/llm/assistant.ts`): respostas determinísticas compostas a partir dos dados reais do dossiê (não é geração livre de texto), preparado para virar uma chamada real com RAG na Fase 2.

Detalhes completos, diagrama de módulos e fluxos em [ARCHITECTURE.md](./ARCHITECTURE.md).

## Limitações conhecidas do MVP

- **Extração de documentos é simulada por padrão, mas pode ser real.** Com `EXTRACTION_PROVIDER=mock` (padrão), os campos "extraídos" são derivados dos dados já cadastrados no dossiê. Com `EXTRACTION_PROVIDER=gemini` + `GEMINI_API_KEY` configurada, o PDF/imagem enviado é lido de verdade pela API multimodal do Google Gemini — testado e funcional.
- **Sem Row Level Security nativo.** Mesmo com Postgres em produção, o isolamento multi-tenant continua reforçado na camada de aplicação (`requireTenant()`/`requireRole()`), não em policies nativas do banco. Ver SECURITY.md.
- **Sem billing.** Os planos (Starter/Professional/Enterprise) são placeholders visuais em Configurações — não há cobrança nem limites reais aplicados.
- **Exportação de PDF simples.** O botão "Exportar/Imprimir PDF" usa `window.print()` com CSS de impressão dedicado, não uma biblioteca de geração de PDF no servidor.
- **Sem envio de e-mail/notificações externas.** Convites de usuário e avisos por e-mail estão fora do escopo do MVP.
- **Monitor regulatório não coleta dados reais.** As fontes cadastradas são reais (URLs do MAPA, DOU, Planalto etc.), mas a "verificação" (mesmo a automática ao abrir a página) e as publicações detectadas são simuladas — não há scraping/crawling real.
- **Preview de documentos.** Os arquivos são armazenados (disco local ou Vercel Blob, conforme o ambiente) com checksum, mas não há visualizador de PDF/imagem embutido no MVP.

## Roadmap

**Fase 2** — ~~OCR real~~ (Gemini já implementado e funcional; Google Document AI/Vision seguem como placeholders alternativos), RAG regulatório de verdade para o Assistente de Auditoria, integração com as fontes oficiais (scraping/crawling real em vez de simulado), exportação de PDF robusta (ex. `@react-pdf/renderer` ou Puppeteer), assinatura digital, notificações por e-mail, RLS nativo do Postgres em produção, versionamento avançado de regras com diff visual.

**Fase 3** — suporte a azeite, alimentos, cosméticos e farmacêuticos; APIs para integração com sistemas de despacho aduaneiro; billing SaaS real; SSO; integrações governamentais quando viáveis (Portal Único Siscomex, Receita Federal).

## Estrutura do projeto

```
prisma/               schema.prisma, migrations, seed.ts (dados de demonstração)
src/app/               rotas (App Router): login, onboarding, /app/** (área autenticada)
src/components/ui/     primitives shadcn/ui (Radix + CVA), escritas à mão
src/components/layout/ sidebar, topbar, page header
src/components/domain/ badges de status/severidade reutilizados em todo o app
src/lib/rules/         motor de regras: calculations.ts (funções puras), definitions.ts (as 15 regras), engine.ts
src/lib/extraction/    adapters de extração documental (mock + placeholders)
src/lib/llm/           assistente de auditoria (mock)
src/lib/tenant.ts       requireTenant()/requireRole() — a "RLS aplicativa"
src/lib/audit.ts        logAuditEvent() — trilha de auditoria
src/server/actions/     Server Actions (mutações): dossiers, documents, validation, alerts, reports, rules, regulatory, settings, admin
tests/unit/             Vitest
tests/e2e/               Playwright
```

## Checklist de funcionalidades concluídas

- [x] Login/logout, cadastro de organização (onboarding), papéis admin/gestor/analista
- [x] Dashboard executivo com KPIs, gráficos, últimos dossiês, publicações regulatórias novas, risco regulatório
- [x] CRUD de dossiê com todos os campos do escopo (importador, exportador, produtor, IG, safra, lote, embalagem, volume)
- [x] Upload drag-and-drop, classificação por tipo documental, extração simulada com badge de confiança
- [x] Motor de regras com as 15 regras (RULE-001 a RULE-015), versionadas
- [x] Cálculo de volume, detecção de erro caixa×garrafa, comparação de marca com tratamento de safra
- [x] Geração de alertas com severidade, evidência e recomendação
- [x] Tela de revisão humana focada (`/dossiers/[id]/review`) com confirmar/rejeitar/falso positivo/resolver/reatribuir severidade/solicitar documento
- [x] Recalculo de score após revisão de alertas
- [x] Parecer de conformidade com score, classificação, resumo executivo e exportação via impressão
- [x] Timeline de auditoria por dossiê
- [x] Assistente de Auditoria com perguntas sugeridas
- [x] Monitor regulatório multi-fonte com fluxo publicação → análise → conversão em regra
- [x] Editor de regras com ativação/desativação, nova versão, histórico e simulação
- [x] Configurações da organização, plano (placeholder), retenção/LGPD
- [x] Página de Segurança e Governança (RLS aplicativa, provedores de IA, supervisão humana obrigatória)
- [x] Área administrativa (usuários, papéis, status, fontes globais)
- [x] Trilha de auditoria completa para todas as ações relevantes
- [x] Testes unitários das regras de negócio críticas (25 testes)
- [x] Teste E2E do fluxo completo (login → relatório)
- [x] UI responsiva (sidebar colapsável em mobile via `Sheet`)
