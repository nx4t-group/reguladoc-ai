# Regras de validação — RegulaDoc AI

Implementadas em [`src/lib/rules/definitions.ts`](./src/lib/rules/definitions.ts), com a lógica pura testável em [`src/lib/rules/calculations.ts`](./src/lib/rules/calculations.ts) e testes em [`tests/unit/`](./tests/unit/). Cada regra é seedada como uma linha em `ValidationRule` (versão 1, status `ativa`) e pode ser desativada, editada (metadados) ou versionada pela tela **Editor de Regras** (`/app/rules`) sem alterar o código.

Severidades e peso no score (100 − Σ pesos, piso em 0): **crítica −30 · alta −15 · média −7 · baixa −3 · informativa 0**.

Classificação final: **90–100 apto · 75–89 apto com ressalvas · 50–74 pendente · abaixo de 50 não recomendado para registro**.

---

### RULE-001 — Presença de lote
**Categoria:** lote · **Severidade:** crítica
O número de lote deve estar presente em documentos críticos (Anexo IX, laudo, certificado de origem, invoice, packing list). Ausência em qualquer um deles gera alerta.

### RULE-002 — Consistência de lote
**Categoria:** lote · **Severidade:** crítica
O lote deve ser idêntico (após normalização) entre todos os documentos que o mencionam. Ex.: `LVT25260101` em todos os documentos.

### RULE-003 — Presença do número do laudo
**Categoria:** laboratório · **Severidade:** alta
O número do laudo deve constar tanto no Anexo IX quanto no laudo de análise. No dossiê de demonstração com erro (`DEMO-IMP-0002`), o laudo está ausente no Anexo IX — alerta gerado.

### RULE-004 — Consistência de marca
**Categoria:** marca · **Severidade:** alta (divergência real) / informativa (equivalência explicável pela safra)
Compara a marca em todos os documentos. Trata a safra como complemento equivalente conhecido: `"Tapada do Fidalgo 2025"` vs. `"Tapada do Fidalgo"` com safra `2025` → **equivalente com ressalva**, não é erro. Qualquer outra diferença — **incluindo uma marca ser substring da outra** — é divergência real: `"Quinta das Carvalhas"` vs. `"Carvalhas"` é tratado como **RULE-004 alta**, exatamente como no dossiê de demonstração com erro.

### RULE-005 — Consistência de denominação
**Categoria:** denominação · **Severidade:** alta
A denominação do produto (ex. "Vinho Fino Tinto Seco") deve ser textualmente compatível (normalizada) entre os documentos.

### RULE-006 — Consistência de indicação geográfica
**Categoria:** indicação geográfica · **Severidade:** alta
Quando presente em mais de um documento, a IG (ex. "Regional Alentejano") deve ser coerente entre eles.

### RULE-007 — Consistência de produtor/engarrafador
**Categoria:** produtor · **Severidade:** alta
O produtor/engarrafador deve ser coerente entre certificado, laudo e demais documentos.

### RULE-008 — Cálculo de volume total
**Categoria:** volume · **Severidade:** crítica
`volume_total = número_de_embalagens × unidades_por_embalagem × capacidade_unitária`. Ex.: 800 caixas × 6 garrafas × 0,75 L = **3.600 L**. Se o volume informado divergir do calculado (tolerância de 0,5 L), alerta crítico com os dois valores na evidência.

### RULE-009 — Erro caixa versus garrafa
**Categoria:** volume · **Severidade:** crítica
Detecta especificamente o erro de tratar o número de caixas como número de garrafas: `informado ≈ caixas × capacidade` (ignorando `unidades_por_embalagem`) e diverge do valor correto. Exemplo do escopo: 900 caixas de 6 garrafas de 0,75 L **não são 675 L** (900 × 0,75), e sim **4.050 L** (900 × 6 × 0,75). Roda em paralelo à RULE-008 — a 008 sinaliza "o volume não bate", a 009 explica especificamente *por que* (root cause), com sugestão de correção incluindo o valor certo.

### RULE-010 — Parâmetros laboratoriais presentes
**Categoria:** laboratório · **Severidade:** alta
O laudo de análise deve informar os parâmetros mínimos: teor alcoólico, acidez total, acidez volátil, açúcares totais, metanol e pH. Parâmetros ausentes são listados no alerta.

### RULE-011 — Ensaios fora de acreditação
**Categoria:** laboratório · **Severidade:** média
Se o laudo indicar (por palavra-chave no campo de observação) que algum ensaio foi realizado fora do escopo de acreditação do laboratório, gera **ressalva informativa/média** — nunca reprova automaticamente. Exige revisão humana explícita.

### RULE-012 — Amostragem não atribuída ao laboratório
**Categoria:** laboratório · **Severidade:** média
Mesmo princípio da RULE-011, para o caso em que o laudo registra que a amostragem não é de responsabilidade do laboratório emissor — ressalva, exige revisão humana, não reprova sozinha.

### RULE-013 — Documento obrigatório ausente
**Categoria:** documentação · **Severidade:** alta
Para um dossiê de vinho, são obrigatórios: Anexo IX, Certificado de Origem, Laudo de Análise, Invoice, Packing List e Rótulo (`REQUIRED_DOCUMENT_TYPES` em `src/lib/constants.ts`). Um alerta é gerado **por tipo de documento ausente** — aparece também como checklist na aba "Visão geral" do dossiê, independente de ter rodado validação.

### RULE-014 — Validação humana obrigatória
**Categoria:** governança · **Severidade:** informativa (não gera alerta por documento)
Regra de processo, não de documento: nenhum dossiê pode ser marcado como aprovado (com ou sem ressalvas) apenas pelo motor de regras. Aplicada estruturalmente em `decideDossier` (`src/server/actions/reports.ts`), que exige papel `gestor`/`admin` e bloqueia a aprovação enquanto houver alerta crítico `aberto`/`confirmado`.

### RULE-015 — Versão de regra
**Categoria:** governança · **Severidade:** informativa (não gera alerta por documento)
Toda validação deve registrar a versão de cada regra aplicada. Aplicada estruturalmente: todo `ValidationRun` grava `rulesVersionSnapshot` (JSON com `{ code, version }` de cada regra ativa usada), visível na aba "Validações" do dossiê e no parecer final.

---

## Editor de regras (`/app/rules`)

- **Ativar/desativar** uma regra (não afeta o histórico de validações já rodadas, só as próximas).
- **Criar nova versão**: cria uma nova linha `ValidationRule` (mesmo `code`, `version + 1`) com metadados atualizados (nome, descrição, severidade, referência normativa, sugestão) e marca a anterior como `inativa` com `effectiveTo` preenchido. O MVP não permite editar a lógica de `evaluate()` pela UI — só metadados, conforme escopo.
- **Simular contra dossiê de exemplo**: roda o motor de regras completo contra `DEMO-IMP-0002` e mostra apenas os achados daquela regra específica, sem persistir nada.
- **Histórico de versões**: lista todas as linhas com o mesmo `code`, ordenadas por versão.
