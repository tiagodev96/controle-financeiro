## Resumo

<!-- O que muda e por quê. Uma frase é o suficiente quando o título já é claro. -->

## PRD / motivação

<!-- Link pra docs/prds/<feature>.md quando aplicável, ou descrição curta do problema. -->

## Plano de teste

<!-- Camadas tocadas (testing trophy). Marque as que se aplicam. -->

- [ ] E2E — Playwright (`tests/e2e/`)
- [ ] Integração — Vitest + Supabase local (`tests/integration/`)
- [ ] Unit — Vitest (`src/**/*.test.ts`)
- [ ] Componente — Vitest + RTL (apenas client components com lógica não trivial)
- [ ] Sem testes (justifique: tipo só, doc, refactor coberto por testes existentes)

## Checklist

- [ ] Loop TDD respeitado (red → green → refactor)
- [ ] `npm run lint && npm run typecheck && npm run test:run && npm run build` verde local
- [ ] Mudança visual revisada no browser (mobile-first, dark + light)
- [ ] Vocabulário e tokens semânticos seguem o design system (sem cores hardcoded, sem termos de gamificação)
- [ ] PRD atualizado se o escopo mudou durante a implementação
