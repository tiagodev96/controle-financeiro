# Cron mensal de recorrentes + cron diário de câmbio

## Problema

Hoje a geração de transactions a partir de `recurring_rules` é manual: owner tem que abrir `/recorrentes` e clicar "Gerar este mês" no dia 1. Se esquece, o dashboard do mês mostra sobra prevista otimista (sem aluguel/NOS/etc), e ele só percebe ao reabrir o app dias depois. Mesmo padrão pra câmbio: a primeira request do dia paga latência de ~300ms pra popular `fx_rates_cache`, e se o cache nunca é populado por outras rotas, o saldo total convertido fica preso na cotação stale.

Dois pontos isolados que cabem na mesma frente porque a infra de cron é compartilhada.

## Usuário afetado

- **owner no início do mês** (peso alto, mensal): dia 1-2, abre o app, espera ver aluguel/contas como pending. Hoje só vê se clicou manualmente.
- **owner no dashboard** (peso alto, diário, lateral): primeira visita do dia, espera ver cotação atualizada sem precisar esperar o fetch online.

Não é pra: trigger oneshot por evento de transaction, refresh em tempo real, push notifications.

## Métrica de sucesso

**Após primeiro deploy do cron, dia 1 do mês seguinte tem ≥ 80% das regras ativas geradas automaticamente até as 6h locais (Lisboa)** + **fx_rates_cache tem entrada nova em ≥ 95% dos dias úteis**. Medido por inspeção de `transactions` e `fx_rates_cache`.

Proxy direto: owner abre o app no dia 2 do mês seguinte e vê aluguel/contas já lançados, sem ter clicado em "Gerar este mês". E vê cotação com `rate_date == hoje` na 1ª visita do dia.

## Escopo

### Dentro

**Endpoints HTTP cron-only** em `src/app/api/cron/`:
- `GET /api/cron/recurring`: invoca `generateRecurringForMonthCore` para cada household ativo no mês corrente. Idempotente — segunda execução no mesmo dia retorna `created: 0`.
- `GET /api/cron/fx`: invoca `refreshFxRatesAction` (chama `getRate({ base:'EUR', quote:'BRL', when: today })` ignorando cache). Idempotente via upsert.

**Autenticação do cron**:
- Header `Authorization: Bearer ${CRON_SECRET}`. Secret armazenado em env var `CRON_SECRET` (Vercel) e validado no handler. Sem secret → 401.
- Vercel injeta o header automaticamente quando o cron job dispara o endpoint (segredo configurável no dashboard ou via `vercel.json`).

**Schedule** em `vercel.json`:
- `crons: [{ path: '/api/cron/recurring', schedule: '0 3 1 * *' }, { path: '/api/cron/fx', schedule: '0 12 * * *' }]`
- Recurring: dia 1 às 3h UTC = 4h Lisboa (verão) / 3h Lisboa (inverno). Tarde o suficiente pra zonas de DST não afetarem; cedo o suficiente pra estar pronto antes da rotina matinal.
- FX: meio-dia UTC = 13h Lisboa (verão), depois da publicação do BCE (~16h CET, mas o `latest` retorna o último útil — meio-dia já tem o do dia anterior se for fim de semana).

**Geração mensal multi-household**:
- Helper novo `listActiveHouseholds(supabase: serviceRole)` que retorna `households.id[]`. Cron itera nessas IDs, chamando o core existente com session sintético (`{ userId: profile.id, householdId: id }`).
- Profile sintético: pega o primeiro profile do household via SQL (preferência: o mais antigo, `order by created_at asc limit 1`). Justificativa: alguém precisa ser o `profile_id` das transactions geradas, e o `core` já espera um session.

**Logs/observabilidade**:
- Cada handler retorna JSON `{ ok: true, summary: {...} }` com counts por household. Vercel Function Logs capturam isso. Sem dashboard custom v1.

### Fora (explicitamente)

- **UI pra inspecionar últimas execuções** — Vercel logs cobrem.
- **Retry automático em caso de erro parcial** — sem retry. Cron roda no dia seguinte e idempotência cobre.
- **Cron por timezone do household** — todos disparam em UTC fixo. Lisbon/America rodando junto não causa problema porque a janela de "início do mês" é generosa (dia 1 às 3h UTC ≈ 22h-4h em todas as zonas razoáveis).
- **Notificação push/email quando gera transactions** — não.
- **Cron pra parcelas/dívidas** — parcelas são geradas no momento da criação do plano (já feito), dívidas não têm noção temporal. Sem cron pra eles.
- **Configuração do schedule via UI/env** — fica em `vercel.json` versionado.
- **Locks distribuídos pra impedir corrida** — idempotência via unique key (recurring: `source_recurring_rule_id` + range de mês; fx: unique constraint em `(rate_date, base, quote)`).
- **Migração das rotas pra dispatcher único** — duas rotas separadas, mais fácil de invocar/debugar individualmente.

## Abordagem proposta

Duas rotas Next.js App Router em `src/app/api/cron/<name>/route.ts`. Cada uma valida o bearer header, instancia `getServiceRoleSupabase()` (bypassa RLS — necessário pra cron sem usuário), chama o core, retorna JSON. Schedule via `vercel.json` no root. Secret via env var.

Helper `requireCronAuth(request)` em `src/server/cron/auth.ts` para evitar repetição.

## Dependências

- **Variável de ambiente nova**: `CRON_SECRET` em `.env.local` e em Vercel (todas as envs).
- **`vercel.json` na raiz** — não existe ainda. Criar com `crons` config.
- **Service role client** (`getServiceRoleSupabase()`) já entregue na frente 1.
- **`generateRecurringForMonthCore`** já existe e é idempotente.
- **`refreshFxRatesAction`**: PRD de câmbio mencionou. Não foi entregue como wrapper separado — `getRate()` faz upsert no caminho cache-miss. Criar wrapper `refreshFxRates({ supabase, serviceSupabase })` que força fetch pra hoje.

## Riscos

- **Cron Vercel free tier limit**: probabilidade média (free permite 2 daily crons IIRC, ou mudou recente). Mitigação: 2 jobs, 1 daily + 1 monthly. Se quebrar limit, fundir em 1 dispatcher.
- **Geração em horário com DST border**: probabilidade baixa, impacto baixo. Vercel cron schedule é UTC, sem ambiguidade.
- **Secret vazado por log**: probabilidade baixa, impacto alto. Mitigação: nunca logar `request.headers`, validar e descartar.
- **Multi-household ainda só tem 1 household no app**: probabilidade alta (owner+co-membro = 1 household), impacto zero — código preparado pra N. Aceitar overhead de iteração.
- **Erro de fetch no frankfurter durante cron**: probabilidade média, impacto baixo (cron loga e segue; dashboard puxa sob demanda como fallback). Aceitar.
- **Trigger SQL `recalc_debt_remaining` em massa**: não aplicável (recurring/fx não criam payments de dívida).

## Hipóteses a validar

- **"Vercel Cron grátis cobre o caso"**: free permite 2 crons no plano hobby (verificar antes de deploy). Se não, virar 1 dispatcher.
- **"3h UTC é horário ok"**: owner abre o app de manhã (8-9h Lisboa). 3h UTC dá 5-6h Lisboa, room sobrando. Validar.

## Open questions

- **Onde o profile sintético pro cron sai?**
  → Proposta: **`profiles.order('created_at asc').limit(1)`** por household. owner é o primeiro profile na seed, consistente. Confirmar.
- **`/api/cron/fx` falha silenciosa ou propaga 500?**
  → Proposta: **500 com `{ ok: false, error }`**, Vercel logs capturam. Cron roda de novo amanhã. Confirmar.
- **Endpoint cron exposto publicamente sem secret**: bom default ou validação obrigatória?
  → Proposta: **obrigatória** (401 se faltar/errar). Confirmar.
- **`vercel.json` versionado tem `regions` ou outras configs?**
  → Proposta: **só `crons`**. Outras configs vão em `next.config` ou via dashboard. Confirmar.
- **Documentar como provisionar `CRON_SECRET`?**
  → Proposta: **README curto em `docs/cron.md`** ou comentário em `.env.example`. Confirmar.
