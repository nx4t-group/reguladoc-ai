# Segurança e Governança — RegulaDoc AI

## Multi-tenancy e isolamento de dados

O MVP roda em **SQLite local**, que não possui Row Level Security nativo (diferente do Postgres, usado pelo Supabase). O isolamento entre organizações é implementado como uma **"RLS aplicativa"**:

- Toda tabela de domínio (`Dossier`, `Document`, `ExtractedField`, `ValidationRule`, `ValidationRun`, `ValidationAlert`, `RegulatorySource`, `RegulatoryItem`, `AuditEvent`, `Report`) tem uma coluna `organizationId` (nullable apenas em `ValidationRule`/`RegulatorySource`/`RegulatoryItem`, onde `null` significa "registro global da plataforma", nunca dado sensível de um tenant).
- Toda página server component sob `/app/**` chama `requireTenant()` ou `requireRole([...])` (`src/lib/tenant.ts`) como primeira operação — essas funções resolvem a sessão via `getServerSession` e redirecionam para `/login` (ou `/app`, no caso de papel insuficiente) se a checagem falhar.
- Toda server action (`src/server/actions/**`) segue o mesmo padrão e usa o `organizationId` **resolvido da sessão**, nunca um valor recebido do cliente, em todo `where` de leitura e todo `data` de escrita do Prisma.
- Arquivos enviados ficam em `storage/uploads/<organizationId>/<dossierId>/`, fora do diretório público do Next; o acesso passa sempre por uma server action que já valida a organização do usuário.

**Plano de migração (Fase 2):** trocar o Prisma/SQLite por Supabase Postgres, ativar RLS nativo nas tabelas com policies espelhando exatamente as checagens hoje feitas em `tenant.ts` (`organization_id = auth.jwt() ->> 'organization_id'`), e manter a mesma função `requireTenant()` como camada de conveniência/legibilidade — RLS nativo vira a garantia de última linha, a aplicação continua filtrando explicitamente por clareza e por defesa em profundidade.

## Autenticação e controle de acesso por papel

- NextAuth v4, provider Credentials, sessão JWT (sem armazenar sessão em banco). Senhas com hash `bcrypt` (`Profile.passwordHash`).
- Três papéis por organização (`OrganizationMember.role`): **admin** (gerencia usuários/papéis, vê fontes globais), **gestor** (aprova/reprova dossiês, gerencia regras), **analista** (opera o dia a dia: upload, extração, validação, revisão de alertas). A aprovação final de um dossiê (`decideDossier`) é restrita a `admin`/`gestor` — reflexo direto da RULE-014 (nenhuma aprovação só pela IA, e nem qualquer usuário pode assinar por um gestor).
- A área `/app/admin` é restrita a `admin` via `requireRole(["admin"])`.

## Trilha de auditoria

Toda ação relevante (`src/lib/audit.ts` → `logAuditEvent`) grava uma linha em `AuditEvent`: quem (`userId`), o quê (`action`, `entityType`, `entityId`), quando (`createdAt`), e o estado antes/depois em JSON (`beforeJson`/`afterJson`) quando aplicável. Cobre: criação de dossiê, upload de documento, mudança de tipo documental, extração executada, validação executada, alerta gerado/revisado, regra alterada, parecer gerado, status alterado, aprovação/reprovação, item regulatório convertido em regra. Visível como timeline na aba "Auditoria" de cada dossiê.

## LGPD e retenção de dados

- Cada organização tem um campo `retentionDays` (padrão 1825 dias / 5 anos), editável em Configurações (`admin`/`gestor`) — define por quanto tempo os documentos de um dossiê devem ser mantidos antes de elegíveis para exclusão lógica.
- Exclusão é sempre **lógica**: `Dossier.deletedAt` (soft delete) — nenhuma rotina do MVP apaga fisicamente linhas do banco ou arquivos do disco; isso fica para a Fase 2 (job de expurgo respeitando `retentionDays`).
- Nenhum documento ou dado é enviado a serviços de IA externos sem configuração explícita: por padrão (`EXTRACTION_PROVIDER=mock`, `LLM_PROVIDER=mock`), toda a "extração" e as respostas do assistente são geradas localmente a partir dos dados já no banco — nada sai do processo Node local. A página **Segurança e Governança** (`/app/security`) exibe o provedor configurado para cada função e sinaliza "Modo simulado" sempre que nenhuma chave real está presente.
- CPF/CNPJ: o cadastro de organização coleta CNPJ para identificação fiscal da comissária/despachante (não é dado pessoal sensível de terceiros); nenhuma tela pública do MVP expõe CPF de pessoa física.

## Supervisão humana obrigatória (RULE-014)

Nenhum dossiê pode ser marcado como aprovado (com ou sem ressalvas) apenas pelo motor de regras. `decideDossier` exige um usuário `gestor`/`admin` autenticado, bloqueia a decisão enquanto houver alerta crítico ainda `aberto`/`confirmado`, e grava o revisor + timestamp no `Report` e no `AuditEvent`. O motor de regras e a extração documental são, por design, **sistemas de apoio à decisão** — organizam e priorizam achados, nunca decidem sozinhos.

## Superfícies de risco conhecidas do MVP (e por que são aceitáveis aqui)

| Risco | Mitigação atual | Correção planejada |
| --- | --- | --- |
| SQLite não tem RLS nativo | RLS aplicativa via `requireTenant()`/`requireRole()` em toda leitura/escrita | Migrar para Postgres + RLS nativo (Fase 2) |
| Arquivos em disco local, não em storage gerenciado | Path scoped por `organizationId`/`dossierId`, nunca servido sem passar por server action autenticada | Supabase Storage com policies por bucket (Fase 2) |
| Sem rate limiting / proteção de força bruta no login | Fora do escopo do MVP | Adicionar rate limiting (ex. Upstash) antes de produção real |
| Sessão JWT sem revogação server-side | Padrão aceitável para MVP de demonstração | Avaliar sessão em banco (`database` strategy) ou blacklist de tokens se necessário |
