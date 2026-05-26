# Snapshots semanais de saldo

> v1.3 do roadmap (spec.md §10). Pré-requisito pra fechar o gap conhecido de "saldo histórico exato" no dashboard e no /resumo de meses passados.

## Problema

Quando o owner abre `/resumo?mes=2026-03` ou `dashboard?mes=2026-03`, o app **não consegue dizer qual era o saldo em 31/março**. O `accounts.balance_cents` é vivo (manualmente editado) e o app não guarda histórico. Resultado:

1. **Hero do mês passado mostra "Sobra do mês" (fluxo paid - paid)** em vez de "Saldo no fim do mês" — semântica diferente e menos útil pro caso de uso de export pra Laine.
2. **/resumo de mês fechado é incompleto**: o número-chave do export ("estávamos com € X no fim de abril") simplesmente não existe.
3. **Comparar mês a mês fica impossível**: "como evoluiu meu saldo de jan pra mai" não tem resposta.

O item 4 do backlog smoke v1 fez navegação de mês passado com workaround (mostrar fluxo). Esse PRD fecha o gap pra valer.

## Usuário afetado

- **Owner abrindo /resumo do mês fechado** (peso alto, frequência mensal): dia 3-5 do mês seguinte abre `/resumo?mes=<mes-anterior>` pra mandar o PNG pra Laine. Hoje o número que importa ("saldo final") não está lá.
- **Owner navegando dashboard de mês passado** (peso médio, frequência baixa): mais por curiosidade — "como foi abril?". Hoje vê fluxo, queria ver saldo.
- **Owner num futuro próximo, pra v1.x de gráfico de evolução** (peso futuro): a tabela de snapshots é o que vai alimentar o gráfico depois. Esse PRD não entrega o gráfico, mas habilita.

Não é pra: bancos, contadores, ou ferramentas externas que precisam de extrato. O snapshot é semanal e é pra UX de "fim do mês", não pra trilha de auditoria diária.

## Métrica de sucesso

**Após 2 meses de cron rodando, o hero do `/resumo?mes=<mes-fechado>` mostra "Saldo no fim do mês: € X" em 100% dos meses cujo snapshot final foi capturado.** Sem fallback pra "Sobra do mês" exceto pros 2-3 meses iniciais (antes do cron pegar ritmo).

Proxy direto: contar quantos `/api/resumo/og?mes=<passado>` retornaram com label "Saldo no fim do mês" vs "Sobra do mês" via log no handler. Se >5% caem no fallback após 2 meses, granularidade semanal não está cobrindo OU cron está falhando — investigar.

## Escopo

### Dentro

**Migration `supabase/migrations/0004_balance_snapshots.sql`**:
- Tabela `account_balance_snapshots` com colunas: `id uuid pk`, `household_id uuid fk`, `account_id uuid fk`, `snapshot_date date`, `balance_cents bigint`, `source text not null default 'auto' check (source in ('auto','manual'))`, `captured_at timestamptz default now()`, `updated_at timestamptz default now()`.
- Constraint `unique (account_id, snapshot_date)` — idempotência: roda 2× no mesmo dia, não duplica.
- Index `(account_id, snapshot_date desc)` — lookup do mais recente ≤ data.
- RLS: select/insert/update/delete só pra rows do household corrente, mesma policy padrão das outras tabelas.

**Edit manual do snapshot**:
- O `source='manual'` é a "marca" de que o owner ajustou aquele snapshot ("fechou com X"). Cron nunca sobrescreve um snapshot já existente (`INSERT ... ON CONFLICT DO NOTHING`), então `manual` é preservado.
- Owner pode também CRIAR snapshot novo pra qualquer data passada (ex: "lembro que em 30/jan tinha € 1.500" mesmo sem cron rodando lá). Cria com `source='manual'`.
- Server actions: `setSnapshotAction({ accountId, snapshotDate, balanceCents })` — upsert que força `source='manual'`. `deleteSnapshotAction({ snapshotId })` — útil pra desfazer um ajuste errado (próximo cron recaptura como `auto`).

**Cron handler `src/app/api/cron/snapshots/route.ts`**:
- Node runtime, autenticado via `Authorization: Bearer <CRON_SECRET>` (mesmo padrão do `/api/cron/recurring`).
- Service-role client (sem session, é o cron rodando).
- Itera todos households → itera `accounts` não-arquivadas → upsert `(account_id, today)` com `balance_cents` atual.
- Retorna summary `{ householdId, accountsSnapshotted }[]`.

**Schedule no `vercel.json`**:
- `0 3 * * 0` — todo domingo 03:00 UTC. 24h depois do cron diário de FX (`0 12 * * *`), evita choque de execução paralela.

**Helper `src/lib/finance/balance-history.ts`**:
- `getBalanceOn(supabase, accountId, date): Promise<{ cents: number; source: 'snapshot' | 'live' }>`.
- Query: snapshot mais recente com `snapshot_date <= date` pra essa account; se nada, fallback pra `accounts.balance_cents` vivo.
- Retorna `source` pra UI decidir se mostra "estimado" ou não.

**Integração no `/resumo` (`src/app/(app)/resumo/page.tsx`)**:
- Quando `isPast`, chama `getBalanceOn` pra cada account no `endOfMonth(targetDate)`.
- Hero do passado vira "Saldo no fim do mês" se TODAS as accounts retornaram `source: 'snapshot'`.
- Se alguma é `source: 'live'` (sem snapshot ainda), mantém hero atual "Sobra do mês" + label discreta "estimado a partir do fluxo, snapshot ainda não capturado".

**Integração no dashboard (`src/app/(app)/page.tsx`)**:
- Mesma lógica do /resumo no hero principal quando `isPast`.

**UI de histórico em `/contas`**:
- Cada `<AccountListItem>` ganha um botão "Histórico" no menu `...`.
- Abre dialog com lista de snapshots ordenados por data desc (mais recentes primeiro), badge `auto`/`manual` por linha.
- Edit inline (pencil) → dialog `<EditSnapshotDialog>` com input de valor (reusa `MoneyInput` com `allowSign`).
- Botão "+ Adicionar snapshot" → dialog com date picker + valor (cria snapshot manual pra data arbitrária no passado).
- Delete (manual) — reseta pro `auto` que existir (ou pra fallback live).

### Fora (explicitamente)

- **Snapshots diários**: 365× ao ano × N households cresce. Semanal é suficiente pra "saldo no fim do mês" e zero pra gráfico mensal/semanal de evolução. Diário fica pra PRD futura se aparecer dor real.
- **Backfill retroativo**: começa do zero quando o cron rodar pela 1ª vez. Não tenta reconstruir histórico anterior somando transações — saldo é manual, transações são opcionalmente acopladas, qualquer reconstrução tem risco de chutar errado.
- **UI pra visualizar histórico de snapshots (gráfico de evolução)**: a tabela existe, o gráfico não. v1.3 do spec menciona "gráfico de evolução do saldo (snapshots semanais)" — esse PRD entrega a *infra*; o gráfico vira PRD própria.
- **Snapshots por categoria ou por dívida**: só por account. Categoria/dívida têm outras formas de medir histórico (sum de transactions, trigger de debt remaining).
- **Editar/deletar snapshot manualmente via UI**: snapshot é histórico — não muda. Se errou, só recapturar no próximo domingo.
- **Pause/resume do cron via UI**: sem botão. Quem precisa pausar mexe na env var `CRON_SECRET` ou desabilita no Vercel.
- **Notificação ao usuário quando snapshot é capturado**: silencioso. Não é evento que o usuário precisa saber.
- **Snapshot do saldo *previsto* fim do mês**: só do saldo manual atual. Previsões mudam toda hora; não vale gravar.

## Abordagem proposta

Migration + cron handler + helper, todos seguindo padrões já estabelecidos no projeto (`0001_initial.sql`, `/api/cron/recurring`, `/api/cron/fx`, `lib/finance/*` helpers). Sem novidade técnica — copy paste com adaptação.

Integração nas duas páginas (`/resumo` e dashboard) é cirúrgica: novo helper substitui o `accounts.balance_cents` apenas quando `isPast` e snapshot existe; resto do código não muda. Source `'snapshot' | 'live'` permite UI degradar graciosamente nos primeiros 1-2 meses até o cron acumular dados.

## Dependências

- **Migration aplicada em produção** antes do cron rodar — `npx supabase db push` ou aplicar manualmente no SQL Editor.
- **Env var `CRON_SECRET`** já existe (cron de recurring e fx usam). Sem nova env var.
- **Vercel Cron schedule** atualizado via `vercel.json`. Sem ferramenta nova.
- **Helpers existentes**: `getServiceRoleSupabase`, padrão de cron handler em `src/server/cron/handlers.ts`.

## Riscos

- **Cron falha 3+ semanas seguidas** → gap. Probabilidade baixa (Vercel Cron é confiável), impacto médio. Mitigação: o helper já pega "mais recente ≤ data", então pula gaps. Pior caso: snapshot do dia 10/abr é usado pra estimar fim de abril (em vez do 27/abr). Discrepância de ~3 semanas de movimento, aceitável.
- **Migration roda em prod e quebra** → travamento. Probabilidade muito baixa (só CREATE TABLE/INDEX/POLICY, sem ALTER destrutivo). Mitigação: backup automático do Supabase + migration tem rollback óbvio (DROP TABLE).
- **Owner edita `balance_cents` várias vezes na mesma semana** → snapshot captura só o estado de domingo. Aceitável: não somos sistema bancário, somos resumo mensal.
- **Cron roda mas balance_cents é 0 (recém-zerado)** → snapshot guarda 0. Aceitável: era o estado real naquele momento. Se o owner depois "lembra" e atualiza balance, o snapshot da semana seguinte pega o valor novo; o de domingo passado fica como 0 mesmo (histórico real).
- **Conflict de timezone (DATE coluna)**: `snapshot_date` é `date`, captura no UTC do servidor. Domingo 03:00 UTC = sábado 24:00 ou domingo 00:00 dependendo da TZ do usuário. Aceitável — semantically "snapshot semanal", não vinculado a fuso local.

## Hipóteses a validar

- **"Granularidade semanal é boa o suficiente pro caso de uso de /resumo mensal"** — premissa central. Se o owner reclamar "o saldo do PNG não bate com o que eu tinha no dia 31 real", consideramos: (a) aumentar granularidade pra diário, (b) capturar adicional no último dia do mês via cron mensal, (c) aceitar discrepância. **Validar após 2 meses** — primeira sincera oportunidade é quando ele exportar o /resumo de mês fechado pela 2ª vez.
- **"Owner não vai notar nem se importar quando snapshot está ausente"** — assumimos que nos 1-2 primeiros meses o fallback "Sobra do mês" + label "estimado" é aceitável. Se ele perguntar "por que esse mês não tem saldo?", explicamos uma vez e seguimos.

## Open questions

- **Schedule: domingo 03:00 UTC ou último dia do mês?** Domingo 03:00 = semanal regular. Alternativa: rodar também no dia 1 de cada mês pra garantir snapshot "fim do mês − 1 dia". → **Proposta: só domingo 03:00 agora**, simpler. Se métrica de fallback ficar alta, adiciona o "fim do mês" depois.
- **Que valor o helper retorna quando snapshot existe pro fim do mês mas account não tem balance_cents (=0)?** Snapshot é 0 — usa 0. Não é fallback. → **Confirmado: snapshot é fonte da verdade quando existe**, mesmo se for 0.
- **Histórico de snapshots cresce sem limite — quando podar?** Volume é trivial (~200 rows/ano por household). → **Proposta: não podar nunca**. Se virar problema, adiciona retention policy depois.
- **Onde mostrar a label "estimado" quando source='live' em mês passado?** Pequena, abaixo do hero, mesmo lugar do "projeção: recorrentes + parcelas..." que já existe pra mês futuro. → **Proposta: copiar esse padrão visual**.
- **Como o cron handler descobre o "today" pra usar como `snapshot_date`?** `new Date().toISOString().slice(0, 10)` no UTC. → **Confirmado: UTC, sem timezone math**.
- **Precisa de teste de integração contra Supabase local?** Padrão do projeto: sim, mesma estrutura de `cron.test.ts`. → **Sim, adicionar `I-CRON-SNAP-*` no `tests/integration/cron.test.ts`**.
