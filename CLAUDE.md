# Controle Financeiro — Instruções para Claude Code

Portal pessoal de controle financeiro. Flexível pra uso individual ou compartilhado entre membros do mesmo household. Quando o household tem mais de uma pessoa, todos compartilham o mesmo fluxo: as mesmas contas, rendas e despesas, sem escopos separados por pessoa. RLS por household no Postgres garante que cada household só lê os próprios dados. Sem fins comerciais, sem SaaS. Foco em simplicidade, densidade de dados e uso diário pelo celular.

---

## Stack

- **Framework**: Next.js 16 (App Router, React Server Components, TypeScript estrito, Turbopack). Atenção: Next 16 introduziu Cache Components e tem APIs e convenções que diferem do conhecimento de Next 15. Consultar `node_modules/next/dist/docs/` em casos de dúvida (especialmente sobre `cookies()`, `headers()`, `'use cache'`, `cacheLife`, route segment config). O `AGENTS.md` na raiz reforça isso.
- **Banco**: Postgres via Supabase (free tier) — RLS por household
- **Auth**: Supabase Auth (magic link). Allowlist de 2 emails fixos no env.
- **ORM/queries**: `@supabase/supabase-js` direto + `drizzle-orm` opcional pra queries complexas. Não usar Prisma.
- **Estilo**: Tailwind v4 + design tokens em CSS variables (de `docs/design-system/colors_and_type.css`)
- **UI primitives**: shadcn/ui (Radix por baixo)
- **Ícones**: Lucide React
- **Validação**: Zod nos formulários e nas Server Actions
- **Testes**: Vitest (unit + integração) + React Testing Library (componentes client) + Playwright (E2E). Supabase local pra integração/E2E. MSW opcional pra mockar APIs externas.
- **Hospedagem**: Vercel (preview deploy por branch)
- **PWA**: `next-pwa` ou manifesto manual + service worker mínimo. Instalável na home do iPhone/Android.

Não introduzir dependências fora desta lista sem motivo claro.

---

## Regras de código

- TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`).
- Server Components por padrão. `"use client"` só quando precisar de estado/efeito/event handler.
- Mutações via **Server Actions** (não criar API routes REST exceto para webhooks externos).
- Acesso a banco só via Supabase server client (`@/lib/supabase/server`). Cliente browser só pra realtime/auth.
- Nada de `any`. Tipos vindos do schema Supabase via `supabase gen types typescript`.
- **Dinheiro sempre em centavos** (inteiros). Nada de float. Tipo: `number` representando o valor × 100, ou `BigInt` se passar de 2^31. Conversão pra display em util único (`formatMoney`).
- Datas: armazenar como `date` (sem timezone) para vencimentos; `timestamptz` para eventos. Display sempre em pt-BR (`Intl.DateTimeFormat('pt-BR')`).
- Comentários em PT-BR. Nomes de variáveis/funções em inglês.
- Sem emoji em código nem em copy do produto.

## Padrões visuais

- Dark mode only no v1.
- Mobile-first. Layouts desktop adaptam de mobile, não o contrário.
- Tokens de cor/tipografia/spacing vêm de `docs/design-system/colors_and_type.css`. Copiar pra `src/app/globals.css` no scaffold inicial e importar a partir daí.
- Números **sempre** com JetBrains Mono e `font-variant-numeric: tabular-nums`.
- Formato PT-BR: `R$ 1.240,50`, `€ 1.240,50`. Negativos com sinal de menos e cor `--danger`, nunca parênteses.

## Vocabulário (PT-BR, sentence case)

Saldo atual / Saldo previsto fim do mês / Sobra prevista / Lançar despesa / Lançar entrada / Pago / Pendente / Em atraso / Recorrente / Parcela / Dívida em aberto / Caixinha / Categoria.

**Proibido**: termos de gamificação (League, XP, Streak, Badge, Trophy, Discipline Score, FinCoin, Quest, Real Surplus, Leak). Já foram removidos do design system.

---

## Comandos comuns

```bash
# Setup inicial
npm install
cp .env.example .env.local        # preencher chaves Supabase
npm run dev                       # localhost:3000

# Supabase local (opcional)
npx supabase start
npx supabase db reset             # aplica migrations + seed
npx supabase gen types typescript --local > src/types/database.ts

# Testes
npm run test                      # vitest watch (unit + integração)
npm run test:run                  # vitest single run
npm run test:coverage             # com coverage report
npm run test:e2e                  # playwright (precisa do dev server rodando)
npm run test:e2e:ui               # playwright em modo UI

# Build & lint
npm run build
npm run lint
npm run typecheck

# Deploy (Vercel)
git push origin main              # auto deploy via Vercel GitHub integration
```

---

## Decisões já tomadas (não rediscutir sem motivo)

- Sem bot WhatsApp/Telegram. PWA mobile é a UX rápida.
- Sem importação histórica. Começa do zero com saldo atual.
- Auth com magic link, allowlist de emails (Tiago + Laine).
- Dívidas são entidade separada de parcelas (parcelas têm data, dívidas não).
- Recorrentes são regras que geram transações pendentes no início de cada mês.
- Câmbio EUR/BRL via [frankfurter.app](https://www.frankfurter.app) (BCE oficial, sem chave), cacheado em `fx_rates_cache` por dia.
- Sem gamificação em nenhuma camada do produto.

---

## Estrutura sugerida do projeto (Next.js)

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (app)/
│   │   ├── page.tsx                  ← Dashboard
│   │   ├── lancar/page.tsx           ← Formulário rápido
│   │   ├── transacoes/page.tsx
│   │   ├── dividas/page.tsx
│   │   ├── recorrentes/page.tsx
│   │   ├── categorias/page.tsx
│   │   ├── contas/page.tsx
│   │   └── resumo/page.tsx           ← Export WhatsApp
│   ├── globals.css                   ← tokens + reset
│   └── layout.tsx
├── components/
│   ├── ui/                           ← shadcn primitives
│   └── finance/                      ← StatCard, TxnRow, DebtRow, etc.
├── lib/
│   ├── supabase/
│   │   ├── server.ts
│   │   └── client.ts
│   ├── fx.ts                         ← câmbio + cache
│   ├── money.ts                      ← format/parse centavos
│   └── projections.ts                ← cálculo de previsão fim do mês
├── types/database.ts                 ← gerado pelo Supabase CLI
└── server/
    └── actions/                      ← Server Actions agrupadas por domínio
```

---

## Disciplina de TDD (regra-mãe do projeto)

**Toda feature começa com teste failing antes de qualquer linha de implementação.** Sem exceção. O objetivo aqui não é só qualidade — é Tiago aprender o método pra usar profissionalmente depois.

Adotamos **outside-in TDD** (estilo "testing trophy", não pirâmide):

1. **Camada 1 — E2E (Playwright)**: pega o fluxo do usuário ("lançar despesa", "marcar como pago", "exportar resumo"). Escreve o teste cenário → roda → red. É o teste que prova que a feature existe.
2. **Camada 2 — Integração (Vitest + Supabase local)**: pega Server Actions, queries SQL, triggers e a heurística de sugestão de dívida. Hita o Supabase local de verdade (não mock). Cobertura mais densa aqui — é onde os bugs caros aparecem.
3. **Camada 3 — Unit (Vitest)**: pega funções puras em `src/lib/` (money, projections, fx, formatters, parsers). Refatorar pra extrair lógica e testar isolado.
4. **Camada 4 — Componente (Vitest + React Testing Library)**: só pra client components com lógica interna não-trivial (forms com validação dinâmica, calculadoras inline). Page components RSC não testar diretamente — testar via E2E.

**Loop por feature:**

1. Invocar `product-management:write-spec` → produz `docs/prds/<feature>.md` (problema, escopo, critérios de aceite).
2. Invocar `engineering:testing-strategy` → define quais camadas de teste a feature exige, quais cenários.
3. Escrever o(s) teste(s) E2E ou de integração da feature → rodar → red.
4. Implementar o mínimo que faz passar → green.
5. Refatorar, extraindo lógica pra `src/lib/` com testes unitários próprios.
6. Invocar `engineering:code-review` antes de commitar.

**Stack de teste:**

- **Vitest** (`vitest`, `@vitest/coverage-v8`) — unit + integração
- **React Testing Library** (`@testing-library/react`, `@testing-library/jest-dom`) — componentes client
- **Playwright** (`@playwright/test`) — E2E, instalado com `npx playwright install --with-deps chromium`
- **Supabase Local** (`supabase` CLI) — instância postgres + auth real pra integração e E2E
- **MSW** opcional pra mockar frankfurter.app em testes

**Coverage mínimo**: 80% global, 95% em `src/lib/`. Pipeline CI quebra se cair abaixo. `src/app/` ignorado do coverage gate (cobertura vem do E2E).

**Atritos conhecidos pra antecipar:**

- Server Components async: não tente renderizar via RTL. Teste por E2E ou refatore lógica pra função pura.
- Server Actions: teste como função (importa e chama com mock de cookies/auth) ou via E2E.
- RLS: testes de integração rodam contra Supabase local com usuário de teste seedado, não service role.

Leia `docs/tdd.md` pra exemplo concreto do loop.

---

## Skills disponíveis e quando invocar

Plugins instalados no Claude Code: `engineering`, `product-management`, `design`, `brightdata-plugin`.

| Momento | Skill |
|---|---|
| Início de feature nova (vai escrever código) | `product-management:write-spec` → gera PRD em `docs/prds/<feature>.md` |
| Decidir o que testar e em qual camada | `engineering:testing-strategy` |
| Antes de inventar uma arquitetura nova (escolha técnica não-óbvia) | `engineering:architecture` (gera ADR em `docs/adrs/`) |
| Design de página/tela (antes de codar layout) | `design:design-system` + `brightdata-plugin:design-mirror` apontando pra Linear/Mercury/Wise/Nubank |
| Microcopy de UI | `design:ux-copy` |
| A11y antes de mergear feature visível | `design:accessibility-review` |
| Code review antes de cada commit relevante | `engineering:code-review` |
| Bug em produção/dev que não cede | `engineering:debug` |
| Antes de deploy importante | `engineering:deploy-checklist` |

Regra: **invoque a skill explicitamente** no prompt (ex.: "use engineering:testing-strategy pra desenhar como testar essa feature"). Não confie no auto-trigger.

---

## Onde ler antes de começar

1. `docs/spec.md` — especificação funcional completa do MVP.
2. `docs/tdd.md` — guia prático do ciclo TDD outside-in (com exemplo).
3. `docs/schema.sql` — schema Postgres + RLS, pronto pra rodar no Supabase.
4. `docs/design-system/README.md` — guia visual e vocabulário.
5. `docs/design-system/colors_and_type.css` — tokens (copiar pra `src/app/globals.css`).
6. `reference/reference-sheet.xlsx` — planilha antiga do Tiago, **apenas referência** de padrões de uso. Não importar.
