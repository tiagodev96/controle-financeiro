---
name: controle-financeiro-design
description: Use this skill to generate well-branded interfaces and assets for Controle Financeiro — portal pessoal de controle financeiro de um casal (Owner + Member), mobile-first PWA, dark mode + light, multi-moeda EUR/BRL, PT-BR, zero gamificação. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

**Foundations to load:**
- `colors_and_type.css` — full token system: cor, type, espaço, raios, motion, sombras. Inclui `[data-theme="light"]` e `[data-theme="auto"]` overrides.
- `preview/*` — cards isolados de cada token e componente. Use como referência rápida visual.
- `ui_kits/pwa/*` — React components (Icon, Num, HeroNumber, Eyebrow, StatusPill, Btn, Card, CCY) + 9 screens (Dashboard, Lançar, Dívidas, Transações, Contas, Resumo, Recorrentes, Categorias, Mais). Toggle dark/light/auto persistido.

**Regras invioláveis ao desenhar pra este produto:**
1. **PT-BR sentence case.** Vocabulário canônico: Saldo atual, Sobra prevista, Pago/Pendente/Em atraso, Recorrente, Parcela N/M, Dívida em aberto, Lançar despesa/entrada, Categoria.
2. **Sem emoji** na UI. Exceção única e isolada: export de "resumo do mês para WhatsApp" usa 4 emojis funcionais (💰 📊 ✅ ⏳).
3. **Sem gamificação.** Termos proibidos: XP, League, Streak, Badge, Trophy, Discipline Score, FinCoin, Quest, Real Surplus, Leak, mascote, ilustração 3D.
4. **Números são herói.** Sempre `tabular-nums` + `lnum`, peso 600–700, tracking negativo. Negativos com `−` (U+2212) + cor `--money-negative`. **Nunca parênteses.** Formato PT-BR: `R$ 1.240,50`, `€ 1.240,50`.
5. **Acento único: brass** (`--brand`). Reservado a primary CTA, foco, nav ativo. **Nunca** para dinheiro — verde-sage é entrada, clay-red é despesa.
6. **Sem gradientes decorativos, sem texturas, sem ilustrações 3D, sem glassmorphism em tudo.** Único blur permitido: bottom nav.
7. **Dark mode é o default.** Light mode existe via `[data-theme="light"]`. Quando renderizar para uma das duas, mantenha contraste — a paleta light já é calibrada.
8. **Mobile-first.** Toque mínimo 44px. `--app-max-width: 440px`. Bottom nav fixa de 5 colunas (Dashboard / Lançar / Transações / Dívidas / Mais).
9. **Ícones: Lucide** (stroke 1.6, linecap round, 22px nav / 14–16px inline). Em produção: `lucide-react`. No UI kit aqui, SVGs equivalentes inline em `components.jsx`.
10. **Tipografia: Geist + JetBrains Mono.** Não há serif no sistema. Toda hierarquia sai de peso/tamanho/tracking/cor/casing.

**Voz e tom:**
- Impessoal, operacional, sem entusiasmo performático.
- ✅ "Sua sobra prevista é € 612,40. Quitar € 367,44 da Empréstimo Jefferson (19,6%)."
- ❌ "Bem-vindo de volta, Owner! Que tal lançar uma despesa hoje? 💪"

**Se for criar artefato visual** (slide, mockup, prototype, throwaway): copie os assets relevantes desta pasta, importe `colors_and_type.css`, monte HTML estático no padrão das `preview/*` ou React no padrão das `ui_kits/pwa/screens.jsx`.

**Se for trabalhar em produção** (Next.js + Tailwind v4 + shadcn/ui): copie `colors_and_type.css` para `src/app/globals.css`, leia os componentes em `ui_kits/pwa/` como referência de hierarquia/estrutura (não copie a implementação 1:1 — em produção, use shadcn primitives e os tokens).

**Se o usuário invocar a skill sem contexto adicional**, pergunte:
- Tela ou componente específico? (Dashboard, Lançar, Dívidas, Transações, Categorias, Contas, Resumo, ou novo?)
- Dark, light ou ambos?
- Output: artefato visual (HTML estático) ou código de produção (Next.js + Tailwind)?
- Variações? (Quantas opções? Em que dimensões — layout, copy, densidade, motion?)

Aja como designer expert do produto, não como executor passivo. Aponte tensões com as regras invioláveis acima quando perceber.
