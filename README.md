# Controle Financeiro

> Portal pessoal de controle financeiro. Funciona pra você sozinho ou pra um grupo pequeno que compartilha as mesmas contas. Quando há mais de uma pessoa no household, todos veem exatamente o mesmo fluxo (mesmas contas, mesmas rendas, mesmas despesas), não escopos separados por pessoa. RLS no Postgres garante que cada household só enxerga os próprios dados.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

## Sobre

Aplicativo web pessoal, dark mode, mobile first, instalável como PWA. Não é um produto, é um portal de uso doméstico pra quem entra na allowlist de email. O código é público porque o objetivo também é documentar publicamente como aplicar disciplina de TDD outside-in num projeto Next.js real.

Funcionalidades principais do MVP:

* Multi moeda (EUR e BRL) com câmbio diário via [frankfurter.app](https://www.frankfurter.app).
* Lançamento rápido de despesas e entradas pelo celular.
* Recorrentes que geram transações pendentes a cada virada de mês.
* Parcelas com cronograma fixo (N vezes em datas previstas).
* Dívidas flexíveis com prioridade e sugestão automática de pagamento.
* Dashboard com saldo total, sobra prevista, pago, pendente, em atraso, top categorias.
* Export "resumo do mês" pronto pra colar no WhatsApp.

Detalhes funcionais completos em [`docs/spec.md`](docs/spec.md).

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) |
| Banco | Postgres via Supabase (RLS por household) |
| Auth | Supabase Auth (magic link e allowlist de emails) |
| Estilo | Tailwind v4 com design tokens em CSS variables |
| UI | shadcn/ui (Radix por baixo), ícones Lucide |
| Validação | Zod |
| Testes | Vitest, React Testing Library, Playwright |
| Hospedagem | Vercel |

## Setup local

### Pré requisitos

* **Node** ≥ 20 (`node -v`)
* **npm** ≥ 10
* **Docker** rodando (necessário pro Supabase local)
* **Supabase CLI** (`npm i -g supabase` ou Scoop / Homebrew)

### Passos

```bash
# 1. Instalar deps
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env.local
# edite .env.local com as chaves do seu Supabase local
# (geradas no passo 3 por `npx supabase status`)

# 3. Subir Supabase local (Postgres, Auth e Storage em containers Docker)
npx supabase start
# copie os valores de `npx supabase status` para o .env.local:
#   API URL          -> NEXT_PUBLIC_SUPABASE_URL
#   anon key         -> NEXT_PUBLIC_SUPABASE_ANON_KEY
#   service_role key -> SUPABASE_SERVICE_ROLE_KEY

# 4. Aplicar migration e seed
npx supabase db reset

# 5. Gerar tipos TypeScript a partir do schema
npx supabase gen types typescript --local > src/types/database.ts

# 6. Subir o app
npm run dev
# http://localhost:3000
```

Playwright precisa baixar o Chromium uma vez: `npx playwright install chromium`.

## Scripts

```bash
npm run dev              # dev server (Next + Turbopack)
npm run build            # build production
npm run start            # serve build

npm run lint             # ESLint
npm run lint:fix         # ESLint --fix
npm run typecheck        # tsc --noEmit (strict)

npm test                 # vitest watch (roda typecheck antes)
npm run test:run         # vitest single pass
npm run test:coverage    # vitest com coverage
npm run test:e2e         # Playwright (sobe `next dev` automaticamente)
npm run test:e2e:ui      # Playwright UI mode
```

## TDD outside-in (regra mãe do projeto)

Toda feature começa com **teste falhando** antes de qualquer linha de implementação. Loop padrão:

1. PRD em `docs/prds/<feature>.md`
2. Plano de teste (camadas e cenários)
3. Teste E2E ou de integração resulta em **red**
4. Implementação mínima resulta em **green**
5. Refactor com extração de funções puras e unit tests próprios
6. Code review antes do commit

Camadas (testing trophy, não pirâmide):

| Camada | Ferramenta | Cobre |
|---|---|---|
| E2E | Playwright | Fluxos do usuário ponta a ponta |
| Integração | Vitest com Supabase local | Server Actions, queries, triggers, RLS |
| Unit | Vitest | Funções puras em `src/lib/` |
| Componente | Vitest com RTL | Client components com lógica não trivial |

Threshold de coverage: 80% global, 95% em `src/lib/`. Guia completo do método em [`docs/tdd.md`](docs/tdd.md).

## Estrutura

```
.
├── src/
│   ├── app/                       App Router com route groups (auth) e (app)
│   ├── components/{ui,finance}/   primitives shadcn e componentes de domínio
│   ├── lib/                       funções puras (money, fx, projections, supabase)
│   ├── server/actions/            Server Actions agrupadas por domínio
│   └── types/database.ts          gerado pelo Supabase CLI
├── tests/
│   ├── e2e/                       Playwright
│   ├── integration/               Vitest contra Supabase local
│   └── setup.ts                   matchers do jest-dom
├── supabase/
│   ├── migrations/                SQL aplicado em `supabase db reset`
│   ├── seed.sql                   seed local (sem dados reais)
│   └── config.toml
├── docs/
│   ├── spec.md                    spec funcional do MVP
│   ├── tdd.md                     guia do ciclo TDD
│   ├── schema.sql                 schema fonte (espelhado em migrations/)
│   └── design-system/             tokens, vocabulário, referências
├── CLAUDE.md                      instruções pro Claude Code (stack e regras)
└── AGENTS.md                      nota sobre Next 16 vs conhecimento prévio
```

## Segurança

Repositório público. Nada sensível é commitado (chaves do Supabase real, emails da allowlist e dados pessoais ficam só no `.env.local`, que está no `.gitignore`). Antes de forkar pra uso real, leia [`docs/security-notes.md`](docs/security-notes.md) com o checklist de hardening (Auth Hook, rotação de chaves, auditoria de RLS).

## Contribuição

Projeto pessoal. Issues e PRs externos não serão revisados. Forque à vontade se quiser usar como base pro seu próprio controle financeiro.

## Licença

Sem licença explícita ainda. Veja [docs/](docs/) e [`CLAUDE.md`](CLAUDE.md) pra detalhes do projeto.
