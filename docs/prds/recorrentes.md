# Recorrentes (regras + gerar transactions)

## Problema

Despesas e entradas que **se repetem todo mês** (aluguel, NOS, salário, freela mensal) hoje precisam ser lançadas manualmente uma a uma, todo mês. Dois efeitos compostos:

1. **A sobra prevista do dashboard é otimista** porque ignora aluguel/contas/etc que o usuário sabe que vão sair, mas não lançou ainda no mês corrente.
2. **Fricção alta no início do mês** — Tiago/Laine teriam que lembrar de 5-8 itens repetidos e re-digitar tudo, o que joga contra a premissa de uso em ≤10s.

A rota `/recorrentes` aparece no nav (sidebar + Mais) e retorna 404 — quebra confiança.

## Usuário afetado

- **Tiago no dia 1-2 de cada mês** (peso alto, frequência mensal): abre /recorrentes, clica "Gerar este mês", e os pendentes aparecem em /transacoes pra ele ir pagando.
- **Tiago/Laine criando regra nova** (peso médio, ocasional): "a partir desse mês temos um novo seguro, R$ 89 todo dia 10" → cria regra.
- **Tiago pausando regra** (peso baixo): viagem de férias, mês em que não vai ter NOS porque mudou de fornecedor, etc.

Não é pra: lançamentos one-off (esses continuam em /lancar), transações com valor variável (luz que muda todo mês — não cabe em regra fixa).

## Métrica de sucesso

**Após primeira semana de uso real, ≥ 80% das despesas recorrentes do mês corrente foram lançadas via regra** (e não via /lancar manual), medido por `count(transactions where source_recurring_rule_id is not null) / count(transactions criadas a partir de regra conhecida)`. Se ficar abaixo, a fricção de gerar/criar regra é maior que digitar manual — repensar UX da geração.

Proxy direto na primeira semana: Tiago cria pelo menos 3 regras (aluguel, NOS, salário) e clica "Gerar este mês" sem suporte.

## Escopo

### Dentro

**CRUD de regras** (paralelo a /categorias e /contas):
- `/recorrentes` lista regras agrupadas em **Ativas** e **Pausadas**. Empty state se sem regras.
- Dialog "Nova regra" com campos:
  - `title` (text, required, 50 char max)
  - `valor` (MoneyInput, required, > 0)
  - `direction` (toggle Despesa/Entrada)
  - `categoria` (chip selector filtrado por kind do direction)
  - `conta` (select)
  - `day_of_month` (input number 1-28 — UI clampa, evita borda 29/30/31)
  - `notas` (textarea, opcional, 200 char max)
- Editar: Dialog igual ao create, pré-preenchido. Direction e currency NÃO editáveis (mesma razão das transactions — semantics quebra).
- Pausar/Retomar: toggle `is_paused`. Não some da lista, vai pra seção Pausadas.
- Cancelar (hard delete): remove a regra. Transactions já geradas com `source_recurring_rule_id = rule.id` permanecem; FK seta `null` via `on delete set null`.

**Geração mensal manual**:
- Botão "Gerar este mês" no topo de `/recorrentes`. Server action `generateRecurringForMonthAction()`:
  - Carrega todas as regras ativas (is_paused=false, active_from <= último dia do mês corrente, active_until null OR >= primeiro dia do mês).
  - Para cada regra:
    - Calcula `occurred_on = YYYY-MM-${clamp(day_of_month, lastDayOfMonth)}`.
    - Verifica se já existe transaction com `source_recurring_rule_id = rule.id` AND `occurred_on` no range do mês corrente. Se sim, pula (idempotente).
    - Insere transaction com `status='pending'`, `paid_on=null`, currency derivada da conta, demais campos da regra.
  - Retorna `{created: N, skipped: M, failed: K}`.
- Toast pós-execução: "Geradas N transações pendentes." (ou "Tudo já lançado neste mês." se created=0 e skipped > 0).
- Sem cron automático no v1 — botão manual.

**Visibilidade**:
- /transacoes já distingue rule-origin se quiser via `source_recurring_rule_id` no schema. v1 **não** adiciona indicação visual ainda (PRD futura: pill "REC" na TxnRow). Mantém escopo enxuto.

### Fora (explicitamente)

- **Cron automático no dia 1** (Supabase Edge Function + scheduled trigger). PRD futura — geração manual no v1.
- **`frequency='yearly'`** — schema aceita mas UI/geração só monthly. Anual fica pra quando aparecer caso real (IPVA, IPTU).
- **Editar regra altera transactions já geradas naquele mês**. Sem propagação. Editar vale só pra próximas gerações.
- **Indicação visual "REC" nas transactions geradas** — PRD futura, baixo valor isolado.
- **Importação de regras** (CSV, planilha).
- **Sugestão automática** ("você tem 4 transactions de Mercado de R$ 600 nos últimos 4 meses, criar regra?") — analytics futura.
- **Edição em massa**.
- **Histórico de gerações** (audit log de quando cada regra foi gerada).
- **Soft delete / lixeira pra regra**.
- **active_from / active_until** editáveis na UI v1 — UI sempre usa `today` como active_from e `null` como active_until. Quando aparecer uso, expor.

## Abordagem proposta

Pages e components seguem exatamente o pattern do CRUD de categorias/contas — `<RecurringRuleListItem>` client (menu •••, derived state pro inline edit), `<CreateRecurringRuleDialog>` client. Server actions em `src/server/actions/recurring/` espelham a estrutura `core.ts` + `actions.ts` de categories.

Geração: `generateRecurringCore({supabase, session}, {monthIso})` em `src/server/actions/recurring/generate-core.ts`. Função pura sobre supabase: lê rules, lê transactions existentes do mês, faz diff, retorna o que precisa inserir. Bulk insert único no fim. Testável via integração contra Supabase local.

`/transacoes` JÁ agrega corretamente as transactions geradas — sem mudança lá. Dashboard sobra prevista também — já está pronto pra incluí-las (helper `calculateMonthStats` itera todas as pending do mês independente da origem).

## Dependências

- **Schema**: pronto. Sem migration.
- **RLS**: existing policy `recurring by household` cobre.
- **`listAllCategoriesForHousehold`** e **`listAllAccountsForHousehold`** (já existem do CRUD).
- **Sonner toast** (já montado no AppLayout).

## Riscos

- **Geração duplicar transactions** se a query de "já existe" falhar: probabilidade baixa (check via `source_recurring_rule_id` + range de mês é específico), impacto médio (Tiago vê duas linhas iguais e deleta uma). Mitigação: integração test específica pra idempotência (clicar duas vezes seguidas → segundo retorna `created: 0, skipped: N`).
- **Regra com day_of_month=31 e mês com 30 dias**: clampa pra último dia. Visualmente confuso? Mitigação: UI bloqueia em 28 (PRD diz isso). Schema permite 31 — se vier migration externa, clamp safety.
- **Editar regra e clicar gerar sem perceber que mês já foi gerado com valor antigo**: probabilidade alta (Tiago muda valor do aluguel e clica gerar, mas mês corrente já tem transaction com valor antigo). Aceitar — geração é idempotente, não sobrescreve. Mitigação: copy do botão deixa claro "gera só o que falta" + toast distingue "criadas vs já existentes".
- **Categoria/conta da regra arquivada**: probabilidade média ao longo do tempo, impacto baixo (geração ainda funciona pq schema permite categoria arquivada na transaction). Sem mitigação no v1 — apenas mostra a regra com warning visual se categoria/conta arquivadas.
- **Sem trigger automático**: probabilidade alta de Tiago esquecer de clicar "Gerar este mês" no início. Mitigação: toast/badge no dashboard se mês corrente tem regras não-geradas. **Considerar nessa PRD ou futura?** → Sinal pequeno no /recorrentes: contagem de regras ativas + indicador "X não geradas neste mês".

## Hipóteses a validar

- **"Geração manual mensal é UX aceitável"**. Premissa: Tiago abre /recorrentes no dia 1-2 do mês e clica. Validar — se em 2 meses Tiago esquecer e gerar dia 15, considerar cron.
- **"day_of_month único por regra é suficiente"**. Premissa: ninguém tem despesa "todo dia 5 e dia 20". Se aparecer, criar 2 regras. Validar com uso real.
- **"Sem indicador visual `REC` na transaction inicial é OK"** — usuário não precisa saber a origem da transaction pra pagar. Validar — se gerar confusão, adicionar.

## Open questions

- **Botão "Gerar este mês" — onde?** → Resposta proposta: trailing do AppTopBar de `/recorrentes`, ao lado do "Nova regra". Confirmar.
- **Contagem "X regras não geradas neste mês" no header?** → Resposta proposta: SIM como eyebrow ou hint. Ex: "8 ativas · 3 ainda não geradas em maio". Confirmar.
- **Editar Dialog reusa do create ou separado?** → Resposta proposta: mesmo componente, prop `mode='create'|'edit'` + `initialRule?`. Confirmar.
- **Geração com regra que tem categoria=null ou conta=null (FK on delete set null)?** → Resposta proposta: pula a regra na geração, retorna em `failed`. Não bloqueia o batch. Confirmar.
- **Geração mostra qual regra foi pulada e por quê?** → Resposta proposta: NÃO no v1. Toast só conta agregada. Se debug for útil, log no console server-side. Confirmar.
- **Permitir gerar de qualquer mês passado/futuro, ou só mês corrente?** → Resposta proposta: só mês corrente no v1. Botão fixo "Gerar este mês". Selecionar mês adiciona UI sem caso de uso real ainda. Confirmar.
