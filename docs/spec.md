# Controle Financeiro — Especificação do MVP

> Documento de referência para implementação. Leitura obrigatória antes do primeiro commit. Veja `CLAUDE.md` na raiz para decisões de stack e padrões de código.

---

## 1. Visão e escopo

Portal web pessoal para um casal acompanhar as finanças do mês: lançar despesas e entradas pelo celular, conferir o saldo atual e a previsão de fechamento, controlar dívidas em aberto, recorrentes e parcelas. Sem fins comerciais. Hospedado privadamente, acesso restrito aos 2 membros do household.

**O MVP entrega:**

1. Cadastro/edição manual de saldo por conta (multi-moeda EUR/BRL com total convertido).
2. Lançamento rápido de despesa/entrada com categoria, conta, autor, status e moeda.
3. Recorrentes que geram transações pendentes automaticamente a cada mês.
4. Parcelas com cronograma fixo (compras divididas em N vezes com datas previstas).
5. Dívidas flexíveis (sem data fixa) com prioridade e sugestão automática de pagamento.
6. Categorias gerenciadas pelo usuário (CRUD).
7. Dashboard com saldo total, sobra prevista, pago/pendente/em atraso, top categorias do mês.
8. Lista de transações do mês com filtros.
9. Export "resumo do mês" em texto pronto pra colar no WhatsApp.

**Fora do MVP** (anotado pra v1.x/v2): metas e caixinhas, limites por categoria, alertas push, gráficos de série temporal, bot de chat, OCR de comprovantes, IA pra insights.

---

## 2. Usuários

- **Owner**: principal, recebe em EUR, mora no Brasil, lança a maioria das despesas.
- **Co-membro** (parceira): co-acessa. Pode lançar pelo celular dela. Vê tudo igual.

Ambos pertencem ao mesmo `household` e enxergam exatamente os mesmos dados. Cada transação registra quem lançou (`profile_id`), permitindo filtrar por autor mais à frente.

Allowlist: emails fixos no env. Quem não está na lista não recebe magic link válido.

---

## 3. Decisões já tomadas

| Item | Decisão |
|---|---|
| Bot WhatsApp/Telegram | Não. PWA mobile resolve. |
| Importação histórica | Não. Começa do zero com saldo atual. |
| Auth | Supabase magic link + allowlist de emails. |
| Stack | Next.js 15 + Supabase + Vercel. |
| Moedas | EUR e BRL. Câmbio via frankfurter.app, cache diário. |
| Dinheiro | Sempre em centavos inteiros no banco. |
| Gamificação | Zero em qualquer camada. |
| Idioma da UI | PT-BR. |

---

## 4. Modelo de dados

Schema completo em `docs/schema.sql`. Resumo conceitual:

**households** — agrupador raiz, 1 por casal. Define moeda base (BRL por padrão).

**profiles** — extends `auth.users`. Cada profile pertence a 1 household.

**accounts** — contas/carteiras com saldo manual. Multi-moeda (EUR ou BRL). Saldo é editado direto pelo usuário ("acabei de receber, agora tem €X na conta"), independente das transações pendentes/pagas — esse é o ponto-chave: o sistema não tenta reconciliar saldo a partir de transações, ele confia no input manual e usa as transações pendentes só pra **prever** o saldo futuro.

**categories** — CRUD do usuário. Cada uma tem `name`, `icon` (Lucide), `color_hint` opcional e `kind` (expense/income/transfer).

**recurring_rules** — regras de recorrência mensal: título, valor, moeda, categoria, conta, dia do mês esperado. Não duplicam transações: existe um **job** (cron Vercel ou função SQL) que **toda virada de mês** gera transações `pending` para cada regra ativa.

**installment_plans** — compras parceladas: total, N parcelas, primeira data, frequência (default 1 mês). Quando criado, o sistema gera N transações pendentes automaticamente.

**debts** — dívidas flexíveis. Sem data prevista. Tem `original_amount_cents`, `remaining_amount_cents` (atualizado por trigger), `priority` (1=alta/2=média/3=baixa), opcional `target_installments` e `target_quit_date`. Pagamento é uma `transaction` normal com `source_debt_id` apontando pra dívida — o trigger SQL recalcula `remaining`.

**transactions** — entrada/saída. Campos principais: `direction`, `amount_cents`, `currency`, `occurred_on` (data esperada/vencimento), `paid_on` (preenchido quando muda pra paid), `status` ('pending'/'paid'), `description`, `category_id`, `account_id`, `profile_id`. Opcionalmente vinculado a `source_recurring_rule_id`, `source_installment_plan_id` (+ `installment_number`), ou `source_debt_id`.

**fx_rates_cache** — cotações diárias EUR↔BRL puxadas do frankfurter.app.

**Notas importantes:**

- Status "em atraso" não é coluna — é derivado: `status = 'pending' AND occurred_on < current_date`. A view `v_month_summary` já calcula isso.
- Saldo da conta NUNCA é mexido pelo trigger de transação. Saldo é manual. Transações entram só na **previsão**.
- Quando o usuário marca uma transação como paga, ele opcionalmente também pode ajustar o saldo da conta pelo mesmo valor (UI sugere isso como ação combinada).

---

## 5. Fluxos principais

### 5.1 Lançar despesa rápida (mobile)

Tela `/lancar`:
1. Campo único de valor (autofocus, numpad, moeda detectada do contexto).
2. Descrição (texto curto).
3. Categoria (chip selector, top 6 mais usadas + ver todas).
4. Conta (selector, lembra última).
5. Toggle "já pago" (default off pra despesa, on pra entrada).
6. Data (default hoje).
7. Botão "Lançar".

Após salvar: toast "Despesa lançada. Saldo previsto: €X" + voltar pro dashboard.

### 5.2 Marcar transação como paga

Em qualquer lista, ação direta (swipe no mobile, botão no desktop). Pergunta opcional: "deduzir do saldo da conta automaticamente?" (default sim). Se sim, executa as duas mutações em transação.

### 5.3 Editar saldo manualmente

Tela `/contas`: lista de contas com valor inline editável. Salvar atualiza `balance_cents` direto.

### 5.4 Cadastrar dívida e pagar

Tela `/dividas` → "+ Nova dívida": título, valor original, moeda, prioridade, notas, opcionais (parcelas-alvo, data-alvo).

Lista mostra cada dívida com barra de progresso (pago/restante). Ação "Registrar pagamento" abre modal: valor, conta de origem, data → cria `transaction` com `source_debt_id`. Trigger SQL atualiza `remaining_amount_cents`. Se chegar a zero, marca como `closed`.

### 5.5 Dashboard

Layout mobile (vertical):

1. **Saldo total** (hero): soma de todas as contas convertida pra moeda base, com breakdown EUR/BRL e cotação usada.
2. **Sobra prevista fim do mês** (card grande): cálculo descrito em §6.2.
3. **Cards de resumo**: pago | pendente | em atraso (valores e contagem).
4. **Sugestão de dívida** (se houver sobra > 0 e dívidas em aberto): "Sua sobra prevista é €X. Sugestão: quitar €Y da dívida 'Z' (W% dela)."
5. **Top 5 categorias do mês** com barra horizontal proporcional.
6. **Próximos 7 dias**: lista enxuta com vencimentos.

### 5.6 Export resumo do mês

Tela `/resumo`: preview do texto formatado pra WhatsApp, com botão "Copiar". Formato sugerido:

```
*Resumo de Maio/2026*

💰 Saldo atual: € 2.183,14
📊 Sobra prevista: € 612,40
✅ Pago: € 1.450,00
⏳ Pendente: € 137,60

*Top categorias*
• Moradia: € 800,00
• Pet: € 92,00
• Saúde: € 70,00

*Dívidas em aberto*
• Empréstimo Jefferson: € 3.000,00
• Notebook: € 875,94

*Próximo mês*
• Aluguel: € 800
• NOS: € 44
• Adobe: € 15
```

> Apesar da regra "sem emoji", aqui é mensagem informal pra WhatsApp pessoal — os 4 emojis são funcionais (identificam seção) e ficam só nesse output exportado. UI do app continua sem emoji.

---

## 6. Regras de cálculo

### 6.1 Saldo total (multi-moeda)

```
totalBaseCurrency = Σ (account.balance_cents × fxRate(account.currency → baseCurrency))
```

Cotação vem da última entrada em `fx_rates_cache` para o dia. Se cache vazio do dia, dispara fetch ao frankfurter.

### 6.2 Sobra prevista fim do mês (por moeda)

```
sobraPrevista =
    saldoAtualDaMoeda
  + entradasPendentesDoMes
  - despesasPendentesDoMes
  - despesasEmAtrasoDoMes
```

(Pago já está refletido no saldo manual se o usuário aceitou a sugestão de deduzir. Se não aceitou em algum momento, há discrepância — o app mostra um aviso sutil quando detecta divergência grande entre `Σ paid` do mês e ajustes feitos em `accounts.balance_cents`.)

Mostrar sobra **por moeda**, sem converter — converter aqui esconde decisões. O total convertido aparece só no card de saldo.

### 6.3 Sugestão de pagamento de dívida

Heurística simples, sem IA:

```
sobraEmEUR = sobraPrevistaEUR  (ou em BRL, dependendo da dívida)
maxAplicavel = sobraEmEUR × 0.6    (teto configurável)

para cada dívida em aberto, ordenada por prioridade asc:
  sugestao = min(maxAplicavel, dívida.remaining)
  se sugestao >= 50:                   # ticket mínimo
    return { dívida, sugestao, percDaDívida: sugestao/dívida.remaining }

retorna apenas a top 1 sugestão no dashboard
```

Card mostra: "Sua sobra prevista é €X. Sugestão: €Y na 'Empréstimo Jefferson' (Z% dela este mês)." Botão "Registrar pagamento" pré-preenche o modal.

### 6.4 Geração de transações de recorrentes

Job mensal (Vercel Cron `0 3 1 * *` — todo dia 1 às 3h UTC):

```
para cada recurring_rule ativa e não pausada:
  occurred_on = primeiroDiaDoMesAtual.set(day = rule.day_of_month) (clampado ao último dia do mês)
  se já não existe transaction com source_recurring_rule_id = rule.id e mesmo mês:
    INSERT transaction (status='pending', occurred_on=..., source_recurring_rule_id=rule.id, ...)
```

Também roda no boot do app a primeira vez do dia, como fallback se o cron falhar (idempotente pelo check de existência).

### 6.5 Geração de transações de parcelas

Imediato, ao criar `installment_plan`:

```
para i de 1 a total_installments:
  occurred_on = first_due_date + (i-1) × frequency_months meses
  amount = round(total_amount_cents / total_installments)  (ajustar arredondamento na última)
  INSERT transaction (status='pending', source_installment_plan_id=plan.id, installment_number=i, ...)
```

---

## 7. Integração de câmbio

Endpoint: `https://api.frankfurter.app/latest?from=EUR&to=BRL` (e vice-versa).

Server Action `lib/fx.ts`:

```ts
async function getRate(base: 'EUR'|'BRL', quote: 'EUR'|'BRL', when = today)
```

Lookup em `fx_rates_cache` para `(rate_date=when, base, quote)`. Se não encontrar, fetch + insert. Se a API falhar e houver cache da última semana, usar e logar aviso. Se nada, expor erro pra UI mostrar "câmbio indisponível, usando última cotação manual" (com input manual de fallback).

Cron Vercel `0 12 * * *` (todo dia ao meio-dia UTC) pré-popula cotação do dia pra evitar fetch sob demanda.

---

## 8. Auth e segurança

- Supabase Auth com magic link (email).
- Allowlist hardcoded em `lib/auth/allowlist.ts` — emails dos membros do household vindos de env var `NEXT_PUBLIC_ALLOWED_EMAILS`.
- Hook no signin que rejeita email fora da allowlist (ou usa Supabase Auth Hook).
- RLS no banco isola por household — defesa em profundidade caso o front falhe.
- Service role key (usada só em Server Actions de câmbio) vai em env var, nunca exposta ao browser.

---

## 9. PWA e mobile

- Manifest com `display: "standalone"`, ícone 512×512 em fundo `--bg-base`, theme color `--bg-base`.
- Service worker mínimo via `next-pwa` ou implementação manual: precache do shell, network-first para dados.
- Viewport mobile sem zoom, safe-area-insets respeitadas (notch iPhone).
- Bottom nav fixo no mobile: Dashboard | Lançar | Transações | Dívidas | Mais.

---

## 10. Roadmap pós-MVP (v1.x / v2)

- v1.1: Metas e caixinhas (envelopes virtuais sobre o saldo).
- v1.2: Limites por categoria + alerta quando ultrapassar.
- v1.3: Gráfico de evolução do saldo (snapshots semanais).
- v2.x: Insights gerados por LLM ("você gastou 35% mais com Pet este mês porque...").

---

## 11. Definição de pronto (MVP)

- [ ] Projeto Next.js scaffoldado, deploy automático no Vercel funcionando.
- [ ] Supabase com schema aplicado, RLS testado (usuário A não vê dados de household B).
- [ ] Magic link login funcional, allowlist bloqueando emails não autorizados.
- [ ] CRUD de categorias, contas, recorrentes, parcelas, dívidas, transações.
- [ ] Saldo manual editável, saldo total multi-moeda no dashboard.
- [ ] Previsão fim do mês calculada e exibida por moeda.
- [ ] Sugestão de pagamento de dívida no dashboard quando há sobra > 0.
- [ ] Cron mensal gera transações de recorrentes (testado mockando data).
- [ ] Câmbio via frankfurter cacheando em fx_rates_cache.
- [ ] Página de resumo do mês com export pra texto.
- [ ] Instalável como PWA no iPhone e Android (testado em ambos).
- [ ] Lint, typecheck e build verdes.

---

## 12. Primeiro prompt no Claude Code

Pré-requisitos no terminal antes de abrir `claude`:

- Node 20+ (`node -v`)
- Supabase CLI instalado (`npm i -g supabase` ou `brew install supabase/tap/supabase`)
- Docker rodando (necessário pro Supabase local)

Abra o terminal nesta pasta (`C:\dev\work\2026\controle-financeiro`) e rode `claude`. Cole **exatamente este prompt** como primeira mensagem:

> Leia `CLAUDE.md`, `docs/spec.md`, `docs/tdd.md` e `docs/schema.sql`. Entenda que este projeto roda **TDD outside-in obrigatório** desde o primeiro arquivo de produção. Sua tarefa neste turno é montar o esqueleto + infra de teste, sem criar features.
>
> **Fase 1 — Scaffold Next.js + Tooling**
> 1. Scaffold via `npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"`. Use npm.
> 2. Configure `tsconfig.json` com `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
> 3. Instale runtime deps: `@supabase/supabase-js @supabase/ssr zod lucide-react clsx tailwind-merge date-fns`.
> 4. Instale shadcn/ui (`npx shadcn@latest init`) com tema dark e style "new-york".
> 5. Defina design tokens em `src/app/globals.css` (source of truth única). Histórico: a versão original deste passo apontava pra `docs/design-system/colors_and_type.css`, removido no rework visual; a paleta atual (OKLCH dark + light + IBM Plex Sans + JetBrains Mono) vive direto no globals.css.
>
> **Fase 2 — Infra de teste (TDD-ready desde dia 1)**
> 6. Instale dev deps de teste: `vitest @vitest/coverage-v8 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test`.
> 7. Crie `vitest.config.ts` com `environment: 'jsdom'`, alias `@/*`, setup em `tests/setup.ts` importando `@testing-library/jest-dom`. Coverage com threshold global 80%, `src/lib/` 95%, excluindo `src/app/`.
> 8. Crie `playwright.config.ts` apontando pro dev server em `localhost:3000`, projeto chromium, retries 2 em CI.
> 9. Estrutura de pastas de teste: `tests/e2e/` (Playwright), `tests/integration/` (Vitest contra Supabase local), unit colocalizado (`foo.ts` + `foo.test.ts` na mesma pasta).
> 10. Scripts em `package.json`: `test`, `test:run`, `test:coverage`, `test:e2e`, `test:e2e:ui`, `typecheck`, `lint:fix`. Combine `pretest` que roda `typecheck`.
> 11. Rode `npx playwright install --with-deps chromium`.
>
> **Fase 3 — Supabase local**
> 12. `npx supabase init` na raiz. Crie `supabase/migrations/0001_initial.sql` a partir do conteúdo de `docs/schema.sql`. Crie `supabase/seed.sql` com seed de teste: 1 household, 1 profile (owner), 2 contas vazias (Conta EUR, Conta BRL).
> 13. `npx supabase start` pra rodar local. Confirme funcionando com `npx supabase status`.
> 14. Gere tipos: `npx supabase gen types typescript --local > src/types/database.ts`.
>
> **Fase 4 — Estrutura mínima de código**
> 15. Crie `.env.example` com: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ALLOWED_EMAILS`. Crie `.env.local` apontando pro Supabase local.
> 16. Estruture: `src/app/(auth)/login/`, `src/app/(app)/`, `src/components/{ui,finance}/`, `src/lib/{supabase,fx,money,projections}/`, `src/server/actions/`, `src/types/`.
> 17. Crie `src/lib/supabase/server.ts` e `src/lib/supabase/client.ts` com helpers `@supabase/ssr`.
> 18. Crie layout raiz mobile-first com bottom nav (Dashboard, Lançar, Transações, Dívidas, Mais), tema dark padrão, fontes do design system.
>
> **Fase 5 — Validação**
> 19. Adicione um teste smoke em `src/lib/money/money.test.ts` testando `formatMoney(120050, 'EUR') === '€ 1.200,50'`. Confirme que `npm test` roda, vê o teste failing (função ainda não existe), depois faça-o passar com a implementação mínima. Esse é o primeiro ciclo TDD do projeto.
> 20. Adicione um teste E2E smoke em `tests/e2e/home.spec.ts` que abre `/login` e verifica que o formulário de email aparece. Rode `npm run test:e2e` (com `npm run dev` em outro terminal) e confirme verde.
> 21. Rode `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — tudo verde.
>
> **Pare aqui e me apresente:**
> - `tree -L 3` da estrutura final
> - Conteúdo de `package.json`, `vitest.config.ts`, `playwright.config.ts`, `supabase/seed.sql`, `src/app/layout.tsx`, `src/lib/supabase/server.ts`, `src/lib/money/money.ts` e `src/lib/money/money.test.ts`
> - Output de `npm test` e `npm run test:e2e`
>
> **Regra de comportamento neste turno e nos próximos:** antes de cada decisão técnica não-óbvia (qual versão de Tailwind, como organizar middleware de auth, quando usar Server vs Client Component, como mockar coisa em teste), me pergunte uma vez com opções concretas — não suponha. E invoque skills explicitamente: `engineering:testing-strategy` antes de desenhar testes de uma feature, `product-management:write-spec` antes de implementar feature nova, `design:design-system` + `brightdata-plugin:design-mirror` (apontando pra Linear ou Wise) antes de desenhar layout de página.

Depois desse turno, próximos prompts seguem feature a feature, cada um começando por: `use product-management:write-spec pra produzir docs/prds/<feature>.md, depois use engineering:testing-strategy pra planejar testes, depois TDD outside-in`.
