# Controle Financeiro — Instruções para Claude Code

Portal pessoal de controle financeiro. Flexível pra uso individual ou compartilhado entre membros do mesmo household. Quando o household tem mais de uma pessoa, todos compartilham o mesmo fluxo: as mesmas contas, rendas e despesas, sem escopos separados por pessoa. RLS por household no Postgres garante que cada household só lê os próprios dados. Sem fins comerciais, sem SaaS. Foco em simplicidade, densidade de dados e uso diário pelo celular.

---

## Stack

- **Framework**: Next.js 16 (App Router, React Server Components, TypeScript estrito, Turbopack). Atenção: Next 16 introduziu Cache Components e tem APIs e convenções que diferem do conhecimento de Next 15. Consultar `node_modules/next/dist/docs/` em casos de dúvida (especialmente sobre `cookies()`, `headers()`, `'use cache'`, `cacheLife`, route segment config). O `AGENTS.md` na raiz reforça isso.
- **Banco**: Postgres via Supabase (free tier) — RLS por household
- **Auth**: Supabase Auth (email + senha). Allowlist server-only em `AUTH_ALLOWED_EMAILS`, provisionamento manual no dashboard. Gating via `AUTH_ENABLED`. Detalhes em `docs/prds/password-auth.md`.
- **ORM/queries**: `@supabase/supabase-js` direto + `drizzle-orm` opcional pra queries complexas. Não usar Prisma.
- **Design system**: pasta `design-system/` na raiz (conceito "Livro-razão", paleta OKLCH brass/sage/clay/amber + warm undertone h≈95°). Tokens canônicos em `design-system/colors_and_type.css`; cópia inline em `src/app/globals.css` (source of truth de runtime). Ler `design-system/SKILL.md` e `design-system/README.md` antes de tocar visual.
- **Estilo**: Tailwind v4 + tokens semânticos (`bg-bg-base`, `text-fg1`, `text-brand`, `text-money-positive`, etc).
- **UI primitives**: shadcn/ui (Base UI por baixo)
- **Ícones**: Lucide React, stroke 1.6, linecap round (22px nav, 14–16px inline).
- **Tipografia**: Geist (sans, workhorse) + JetBrains Mono (cotação/tags técnicas). Carregadas via `next/font/google` no `src/app/layout.tsx`. Geist com `tabular-nums` é o stack numérico (incluindo hero).
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

- **Mood — "Livro-razão"**: editorial e preciso, sem serif. Números são o herói. Acento único de bronze velho (`--brand` brass). Verde (`--money-positive` sage) é só pra entrada; vermelho (`--money-negative` clay) é só pra despesa. **Sem gradientes, sem glassmorphism (exceto bottom nav), sem ilustrações 3D**. Tudo em `design-system/`.
- **Tema**: dark default, light opt-in via `[data-theme="light"]`, auto via `[data-theme="auto"]` (segue sistema). Persiste em cookie `cf_theme`. SSR aplica `data-theme` no `<html>` pra evitar FOUC. Toggle cicla 3 estados (dark → light → auto).
- **Layout**: mobile-first, `max-w-110` (440px) em main e bottom nav. Bottom nav fixa de **5 colunas** (Dashboard / Lançar / Transações / Dívidas / Mais). Touch min 44px.
- **Números** sempre com `.num` (font Geist + `tabular-nums` + `tnum`/`lnum`/`ss01`). Variantes: `.num--hero` (56px), `.num--stat` (32px), `.num--positive` (sage), `.num--negative` (clay).
- **Formato PT-BR**: `R$ 1.240,50`, `€ 1.240,50`. Negativos com `−` (U+2212, não hífen) + cor `--money-negative`. **Nunca parênteses**.
- **Sentence case** em títulos e labels. **UPPERCASE tracking 0.08em** só em eyebrows (use classe `.eyebrow`).
- **Ícones**: Lucide React, `strokeWidth={1.6}`.

## Vocabulário (PT-BR, sentence case)

Saldo atual / Saldo previsto fim do mês / Sobra prevista / Lançar despesa / Lançar entrada / Pago / Pendente / Em atraso / Recorrente / Parcela / Dívida em aberto / Categoria.

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
- Auth com email + senha + allowlist server-only. Magic link foi avaliado e descartado (custo > benefício pra 2 usuários conhecidos). Detalhes em `docs/prds/password-auth.md`.
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

**Toda feature começa com teste failing antes de qualquer linha de implementação.** Sem exceção. O objetivo aqui não é só qualidade — é o owner aprender o método pra usar profissionalmente depois.

Adotamos **outside-in TDD** (estilo "testing trophy", não pirâmide):

1. **Camada 1 — E2E (Playwright)**: pega o fluxo do usuário ("lançar despesa", "marcar como pago", "exportar resumo"). Escreve o teste cenário → roda → red. É o teste que prova que a feature existe.
2. **Camada 2 — Integração (Vitest + Supabase local)**: pega Server Actions, queries SQL, triggers e a heurística de sugestão de dívida. Hita o Supabase local de verdade (não mock). Cobertura mais densa aqui — é onde os bugs caros aparecem.
3. **Camada 3 — Unit (Vitest)**: pega funções puras em `src/lib/` (money, projections, fx, formatters, parsers). Refatorar pra extrair lógica e testar isolado.
4. **Camada 4 — Componente (Vitest + React Testing Library)**: só pra client components com lógica interna não-trivial (forms com validação dinâmica, calculadoras inline). Page components RSC não testar diretamente — testar via E2E.

**Loop por feature:**

1. Invocar a skill `prd` para produzir `docs/prds/<feature>.md` (problema, escopo, critérios de aceite).
2. Sem skill instalada para isso. O Claude desenha manualmente o plano de testes (quais camadas, quais cenários) e apresenta para aprovação antes de escrever o primeiro teste.
3. Escrever o(s) teste(s) E2E ou de integração da feature, rodar, esperar red.
4. Implementar o mínimo que faz passar, esperar green.
5. Refatorar, extraindo lógica pra `src/lib/` com testes unitários próprios.
6. Invocar a skill `review` antes de commitar (revisa o diff atual apontando problemas).
7. Invocar a skill `commit` para criar os commits agrupados.

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

Estado real das skills nesta máquina (verificado em `~/.claude/skills/` e `~/.claude/plugins/installed_plugins.json`):

- **Skills locais instaladas**: `prd`, `debug`, `plan`, `review`, `commit`, `verify`, `simplify`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `run`, `init`, `security-review`.
- **Plugins de marketplace instalados**: só o `obsidian@obsidian-skills` (skills `obsidian:*`).
- **Skills mencionadas no passado mas que NÃO existem na máquina**: `product-management:write-spec`, `engineering:testing-strategy`, `engineering:architecture`, `engineering:code-review`, `engineering:debug`, `engineering:deploy-checklist`, `design:design-system`, `design:ux-copy`, `design:accessibility-review`, `brightdata-plugin:design-mirror`. Nada disso existe no marketplace oficial da Anthropic, então não tente instalar.

| Momento | Skill ou ação |
|---|---|
| Início de feature nova (vai escrever código) | `prd` para gerar `docs/prds/<feature>.md` |
| Decidir o que testar e em qual camada | Sem skill. O Claude desenha manualmente o plano (E2E, integração, unit) e apresenta para aprovação |
| Antes de inventar arquitetura nova (escolha técnica não óbvia) | `plan` (modo planejamento, lê código, propõe etapas, lista riscos) |
| Design de página ou tela (antes de codar layout) | Sem skill. Use referências visuais externas no prompt (links pra Linear, Wise, Nubank, etc) e descreva o resultado esperado |
| Microcopy de UI | Sem skill. Pedir no prompt, validar com a vocabulário definido neste CLAUDE.md |
| A11y antes de mergear feature visível | Sem skill. Pedir no prompt uma revisão manual focada em a11y |
| Code review antes de cada commit relevante | `review` (revisa diff staged + unstaged apontando problemas) |
| Verificação manual da feature funcionando | `verify` (roda o app e observa o comportamento real) |
| Refactor de qualidade no código alterado | `simplify` |
| Bug em produção ou dev que não cede | `debug` |
| Criar commits ao final do trabalho | `commit` |
| Antes de deploy importante | Sem skill. Rodar manualmente: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` |

Regra: **invocar a skill explicitamente** no prompt (ex.: "use a skill prd pra produzir docs/prds/lancar-despesa.md"). Não confiar no auto-trigger.

---

## Onde ler antes de começar

1. `docs/spec.md` — especificação funcional completa do MVP.
2. `docs/tdd.md` — guia prático do ciclo TDD outside-in (com exemplo).
3. `docs/schema.sql` — schema Postgres + RLS, pronto pra rodar no Supabase.
4. `docs/prds/` — PRDs por feature já entregue ou em andamento (`lancar-despesa`, `password-auth`).
5. `design-system/SKILL.md` + `design-system/README.md` — fonte única do visual (Livro-razão). UI kits de referência em `design-system/ui_kits/pwa/`.
6. `design-system/colors_and_type.css` — tokens canônicos (espelhados em `src/app/globals.css`).
7. `reference/reference-sheet.xlsx` — planilha antiga do owner (gitignored), **apenas referência** local de padrões de uso. Não importar.
