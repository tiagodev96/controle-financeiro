# Controle Financeiro — Design System

> Sistema visual completo para o **Controle Financeiro**, portal web pessoal de um casal (Owner + Member) acompanhar finanças do mês. Mobile-first PWA, dark mode, PT-BR, multi-moeda EUR/BRL, **zero gamificação**.

Esta pasta substitui inteiramente o sistema anterior (`docs/design-system/` do repo, reaproveitado de outro produto). É a fonte única de verdade para tipografia, cor, espaço, motion e componentes.

---

## Conceito · "Livro-razão"

Livro-razão pessoal. **Editorial e preciso, mas sem tipografia serifada.** Os números são o herói da tela. O ambiente é um caderno de contabilidade — em **dark** funciona como livro com tinta paper-cream sobre fundo preto-quase-puro morno; em **light** funciona como papel cream real com tinta dark-ink. Os dois modos são primeiro-cidadão e a escolha é persistida via `localStorage`. Acento único de **bronze velho** (brass) reservado para ações primárias, foco e navegação ativa. Verde **nunca** é cor de marca: fica reservado para sinal de entrada de dinheiro.

O sistema usa **duas famílias** tipográficas:
- **Geist** para tudo: títulos, body, labels, **número-herói** (peso pesado com numerais tabulares). É a workhorse.
- **JetBrains Mono** para detalhe numérico em tabelas, cotação, tags técnicas, meta inferior.

Influências assumidas (não copiadas): Linear (densidade tipográfica e motion sutil), Mercury (números como herói, dark fintech sério), Wise (multi-moeda sem fricção), Nubank app (microcopy curta, cartão como objeto central).

---

## Fontes deste sistema

| Fonte | URL | O que peguei |
|---|---|---|
| GitHub | https://github.com/tiagodev96/controle-financeiro | `CLAUDE.md`, `README.md`, `docs/spec.md`, componentes `src/components/finance/*` (lancar-form, money-input, bottom-nav), `src/lib/finance/categories.ts`, `src/lib/money/format.ts`. **Não** li `docs/design-system/` — está marcado como descartável. |

Para iterar com mais profundidade neste sistema, explore o repositório acima — em especial `docs/spec.md` (regras de cálculo de sobra prevista, dívidas, parcelas, recorrentes) e os componentes em `src/components/finance/`.

---

## Índice

```
.
├── README.md                  ← este arquivo
├── SKILL.md                   ← entrypoint pra Agent Skills / Claude Code
├── colors_and_type.css        ← tokens canônicos: cor, type, espaço, raios, motion, sombras
├── preview/                   ← cards do Design System tab (foundations + componentes)
│   ├── _base.css
│   ├── brand-logo.html
│   ├── iconography.html
│   ├── type-hero-number.html
│   ├── type-labels.html
│   ├── type-scale.html
│   ├── type-numeric.html
│   ├── type-mono.html
│   ├── colors-canvas.html
│   ├── colors-paper.html
│   ├── colors-brass.html
│   ├── colors-money.html
│   ├── colors-status.html
│   ├── colors-lines.html
│   ├── spacing-scale.html
│   ├── spacing-radii.html
│   ├── spacing-elevation.html
│   ├── motion.html
│   ├── comp-buttons.html
│   ├── comp-inputs.html
│   ├── comp-chips.html
│   ├── comp-pills.html
│   ├── comp-stat-cards.html
│   ├── comp-transaction-row.html
│   ├── comp-debt-progress.html
│   └── comp-currency.html
└── ui_kits/
    └── pwa/                   ← UI kit do app mobile (PWA)
        ├── index.html         ← três iPhones: Dashboard, Lançar, Dívidas
        ├── components.jsx     ← Icon, Num, HeroNumber, Editorial, StatusPill, Btn, Card, CCY
        ├── screens.jsx        ← DashboardScreen, LancarScreen, DividasScreen, BottomNav
        └── ios-frame.jsx      ← bezel iPhone
```

---

## Visual Foundations

### Cor

Paleta construída em **OKLCH** para preservar harmonia perceptual entre tons. Subtom **morno** (h≈95° → khaki) em toda a escala neutra — jamais azul-frio.

- **Canvas** (`--ink-0..3`): warm near-black invertido. `--bg-base` (15.5% L) é o fundo da app; `--bg-surface` (18.5%) eleva cards; `--bg-inset` (22%) recebe inputs; `--bg-raised` (26%) é hover de popover.
- **Paper / foreground** (`--fg1..fg5`): warm off-whites. `--fg1` é título e número-herói; `--fg2` corpo; `--fg3` labels e meta; `--fg4` placeholder; `--fg5` desativado.
- **Brass** (brand, `--brass-100..700`): bronze velho. **Único** acento de marca. Aparece em primary CTA, foco, nav ativo, sugestões. **Nunca** em dinheiro.
- **Sage** (`--money-positive*`): verde-sálvia muted. Reservado para entradas (`+€ 2.480,00`) e progresso positivo.
- **Clay** (`--money-negative*`): vermelho-barro morno. Despesas (`−€ 142,55`), "em atraso", erros.
- **Amber** (`--status-pending-*`): laranja-âmbar, distinto da brass (mais alaranjado). Reservado a "pendente".

Sinal de negativo é sempre `−` (sinal de menos) + cor `--money-negative`. **Nunca** parênteses.

### Tipografia

Sistema de **duas** famílias:

| Família | Uso |
|---|---|
| **Geist** (sans) | Body, headings, labels, **número-herói** com `tabular-nums`. Workhorse exclusivo da UI. |
| **JetBrains Mono** | Cotação, códigos de moeda (`EUR`, `BRL`), tags técnicas (`REC`, `3/10`), meta inferior, dates compactas. |

Não há fonte serifada no sistema — toda hierarquia é resolvida por peso, tamanho, tracking, cor e casing.

**Padrão para rótulos sobre o número-herói:** caps tracked 0.08em em 11px (`eyebrow`), color `--fg3`. Exemplo: `SALDO ATUAL` acima de `€ 2.183,14`. Alternativa quieta: sentence-case 13px em `--fg3` (`Saldo atual`). Ver `preview/type-labels.html`.

Escala mobile-first: `--fs-hero` 56px (saldo), `--fs-stat` 32px, `--fs-h1` 28px, body 15px, caption 12px, eyebrow 11px (uppercase, tracked 0.08em).

Todos os números usam:
```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum","lnum","ss01";
letter-spacing: -0.02em;  /* mais apertado nos pesados, -0.035em no hero */
```

Formato PT-BR: `R$ 1.240,50` / `€ 1.240,50`. Símbolo de moeda em Geist 500 (não italic, não serif), color `--fg3`, ligeiramente menor que o inteiro.

### Espaço

Grade de **4px**. Densidade alta — este é um app de dados, não de respiração. Escala `--space-1..10` (4px → 72px). Padding default em cards: `14px 16px`.

### Raios

**Sharp**. `--radius-md` (6px) é o padrão de cards e inputs. `--radius-lg` (10px) só em sheets/modais. `--radius-full` exclusivo para pills e chips. Nada de rounding lúdico.

### Sombras e elevação

Dark mode usa **surface lift** em vez de sombra. Cartões padrão são planos com 1px de borda `--border-soft`. Sombras só em flutuantes:
- `--shadow-2` popover / dropdown
- `--shadow-3` modal / sheet
- `--shadow-focus` ring de foco brass

### Bordas

Três pesos: `--border-soft` (linhas de razão, divisores), `--border` (cards, inputs), `--border-strong` (estado ativo, foco). **A linha horizontal hairline é um motivo central** — separa transações no estilo livro contábil.

### Layout

Mobile-first com `--app-max-width: 440px`. Bottom nav fixa, 5 colunas: Dashboard / Lançar / Transações / Dívidas / Mais. Toque mínimo 44px.

### Imagens / texturas / gradientes

**Não usar.** Sem gradientes decorativos, sem texturas, sem ilustrações 3D, sem padrões repetitivos. Único gradiente permitido: **nenhum**. Se precisar de profundidade, use elevação de superfície (`--bg-raised`).

### Transparência e blur

Reservados a um único caso: a barra de navegação inferior usa `backdrop-filter: blur(20px)` sobre `oklch(15.5% 0.006 95 / 0.92)`, no estilo iOS. Em qualquer outro lugar é proibido — glassmorphism em tudo é exatamente o que evitamos.

### Hover, press, focus

- **Hover** (desktop): aumenta foreground de `--fg2` → `--fg1`, ou troca `--bg-inset` → `--bg-raised`. Nunca opacity 50%.
- **Press** (mobile): troca brand `--brand` → `--brand-pressed`. Sem shrink/scale (não combina com o tom sério).
- **Focus**: `--shadow-focus` (ring brass de 2px) ou borda strong + box-shadow translúcida brass `0 0 0 3px brass/0.18`.

### Motion

Linear-esque: `cubic-bezier(0.2, 0, 0, 1)` para `--ease-out`, 150ms para transições UI padrão (`--dur-fast`), 220ms para mudanças de estado de painel (`--dur-base`). `--ease-spring` (sutil overshoot) existe mas é raríssimo — só para feedback de "valor lançado". **Sem** bounces longos, sem celebrações.

### Cantos de imagem

Não aplicável — este sistema usa zero imagens. Avatares de Owner/Member são monogramas de uma letra em chip circular brass-bg / sage-bg.

---

## Content Fundamentals

### Idioma e tom

**PT-BR exclusivamente.** Sentence case em todos os títulos e labels — nunca Title Case americano. Tom **direto e operacional**, como anotação de quem usa o app todo dia. Sem entusiasmo performático.

- ❌ "Bem-vindo de volta, Owner!" / "Boa tarde 👋"
- ✅ "Dashboard" / "Maio · 2026"

### Vocabulário canônico (não traduzir, não inventar sinônimos)

| Termo | Onde aparece |
|---|---|
| **Saldo atual** | Hero do dashboard |
| **Sobra prevista** | Cálculo de fim do mês |
| **Lançar despesa / entrada** | CTA da tela `/lancar` |
| **Pago / Pendente / Em atraso** | Status de transação |
| **Recorrente** | Regra mensal automática |
| **Parcela 3/10** | Compra parcelada |
| **Dívida em aberto** | Item de `/dividas` |
| **Caixinha** | Reservado pra v1.1 (envelopes) |
| **Categoria** | Grupo de despesa |

**Banido** (resíduo de produto gamificado): XP, League, Streak, Badge, Trophy, Discipline Score, FinCoin, Quest, Real Surplus, Leak, mascote, ilustração 3D.

### Pessoa e voz

Voz é **impessoal de utilitário** — não "você", nem "nós". Frases curtas, verbo no infinitivo nos botões ("Lançar despesa", "Registrar pagamento"). Sugestões usam tom de **observação seca**:

- ✅ "Sua sobra prevista é € 612,40. Quitar € 367,44 da Empréstimo Jefferson (19,6%)."
- ❌ "Que tal usar sua sobra pra adiantar uma dívida? 💪"

### Casing

- **Sentence case** em títulos, headings, labels, opções.
- **UPPERCASE com tracking 0.08em** apenas em eyebrows (pequenos labels acima do número-herói: "PAGO", "PENDENTE", "EM ATRASO", "VALOR", "DESCRIÇÃO").
- Nomes próprios mantidos: "Pingo Doce", "NOS", "Jefferson".

### Emoji

**Não usar em nenhum lugar do produto.** Única exceção documentada e isolada: o export de "Resumo do mês para WhatsApp" usa 4 emojis funcionais (💰 📊 ✅ ⏳) como marcadores de seção. Esse texto sai do app pra outra plataforma — não conta como UI.

### Microcopy exemplo

- Placeholder do campo descrição: `Ex: Pão na padaria` (sentence case, exemplo curto, vocabulário cotidiano BR).
- Toast pós-lançamento: `Despesa lançada · saldo previsto € 1.840,50`. Sem celebração.
- Empty state: `Nenhuma transação em maio. Lançar a primeira.`
- Erro: `Câmbio indisponível, usando última cotação manual.`

---

## Iconography

### Sistema

**Lucide React** (já no stack: `lucide-react`). Stroke `1.6`, `strokeLinecap="round"`, `strokeLinejoin="round"`. Tamanho 22px na bottom nav, 14–16px inline em chips e dentro de linhas.

Substituição: o UI kit nesta pasta (`ui_kits/pwa/components.jsx`) inclui SVGs inline equivalentes a Lucide para os ícones usados (Dashboard, Plus, Receipt, Card, Home, Pet, Health, Fun, Car, Cal, Search, Settings, Refresh, ArrowDown/Up, Check, More, Chevron, Filter, Alert). Em produção, importar direto de `lucide-react`.

### Categorias

Cada categoria do CRUD do usuário recebe um ícone Lucide. Mapeamento sugerido:

| Categoria | Lucide |
|---|---|
| Moradia | `Home` |
| Alimentação | `UtensilsCrossed` |
| Pet | `PawPrint` |
| Saúde | `Heart` |
| Lazer | `Tv` |
| Transporte | `Car` |
| Trabalho | `Briefcase` |
| Educação | `GraduationCap` |

### Logo / Marca

Wordmark `controle · cf` + ponto brass à direita + ícone "mini livro de razão" (retângulo com 4 linhas internas). Vetorial inline. Sem versão raster necessária — render direto em SVG dentro do app shell.

### Emoji e unicode

- **Emoji**: banido na UI. Permitido só no export de resumo WhatsApp.
- **Unicode**: o sinal de menos usa o caractere **`−` (U+2212)**, não hífen `-`. O símbolo de euro `€` é sempre Instrument Serif italic no contexto hero, sans no contexto inline.

---

## Tokens canônicos

`colors_and_type.css` é a fonte única. Estrutura:

1. **Palette raw** — escalas OKLCH puras (`--ink-*`, `--paper-*`, `--brass-*`, `--sage-*`, `--clay-*`, `--amber-*`).
2. **Semantic tokens** — o que a UI consome (`--bg-*`, `--fg*`, `--brand*`, `--money-*`, `--status-*`, `--ring`).
3. **Type** — famílias, escala, tracking, line-height.
4. **Spacing** — escala 4px.
5. **Radii** — sharp scale.
6. **Elevation** — shadow scale (com `--shadow-focus`).
7. **Motion** — duração + easing.
8. **Layout** — `--app-max-width`, `--tap-target`, `--bottom-nav-h`.

Importar no globals.css do app:
```css
@import url('caminho/para/colors_and_type.css');
```

---

## UI Kits

Dois arquivos HTML diferentes — separados pra Babel não engasgar com tudo carregado de uma vez:

### 1. `ui_kits/pwa/index.html` — Mobile kit (PWA)

**25 iPhones + 1 Chrome desktop com 9 telas navegáveis**, organizados em 9 linhas de grade mobile + 1 desktop:

| Linha | Telas |
|---|---|
| 1 — primary flows | Dashboard · Lançar · Dívidas |
| 2 — secondary surfaces | Transações · Contas · Resumo |
| 3 — settings sub-pages | Recorrentes · Categorias · Mais |
| 4 — onboarding | Login (magic link) · Primeira conta · Pronto + PWA install |
| 5 — sheets (modals mobile) | Nova categoria · Nova dívida · Registrar pagamento |
| 6 — motion demo | Pulse / press / fade-up / sheet slide |
| 7 — empty states | Dashboard empty · Transações empty · Dívidas vazia (positivo) |
| 8 — loading + erro mobile | Skeleton shimmer · Câmbio offline · Saldo divergente |
| 9 — toast variants | Sucesso · Erro · Info |
| **Desktop · 1280px** | **9 telas com sidebar navegável** |

### 2. `ui_kits/pwa/desktop-states.html` — Desktop variants

Foca nos padrões desktop que não cabem no kit principal:

| Seção | Conteúdo |
|---|---|
| **01 · Estados** | ChromeWindow 1280px com toggle no header: Empty · Loading (skeleton shimmer) · Câmbio offline (banner âmbar) · Saldo divergente (banner clay com Σ pagos vs saldo manual) |
| **02 · Centered modals** | ChromeWindow com toggle: Nova categoria · Nova dívida · Registrar pagamento · Confirmação destrutiva (apagar transação). Modal centralizado com scrim + scale-in 220ms — NÃO bottom sheet. |
| **03 · Toast stack** | ChromeWindow com toggle Básico/Avançado. **Básico**: sucesso (auto-dismiss 4s), info, erro (persistente). **Avançado**: progress bar visível com countdown, ícone customizado + estado indeterminado (ex: "câmbio atualizando"), undo flow com countdown + botão Desfazer. Animação `cfToastIn` 280ms slide-in horizontal. |
| **04 · Tablet 1024px** | ChromeWindow 1024×720 com layout intermediário: sidebar icon-only 64px (sem labels) · main reflowed em 2-col mas mais apertado · sem painel direito · stat cards em 3-col em vez de 4. |

### Componentes

`components.jsx` (base):
- `<Num cents currency sign size weight color />` — centavos PT-BR, tabular nums, sinal `−` em vermelho-clay.
- `<HeroNumber cents currency />` — split símbolo + inteiro + fração.
- `<Editorial>` / `<Eyebrow>` — primitivas tipográficas.
- `<StatusPill kind>` — pill compacta.
- `<Btn variant size>` — botão base.
- `<Card>` — superfície elevada.
- `<CCY code />` — tag de código de moeda.
- `<Icon.*>` — biblioteca inline (substituir por `lucide-react` em produção).

`extras.jsx` (mobile-specific):
- `<Sheet title>` — bottom-sheet modal mobile (slide-up 280ms).
- `<FormField>` / `<TextInput>` / `<ChipSelect>` — primitives de formulário.
- `<InstallBanner>` — passos pra instalar PWA.

`iterations.jsx` (estados e toast mobile):
- `<Toast kind title body action>` — notificação bottom-anchored mobile.
- `<EmptyShell>` — wrapper de empty state.

`desktop.jsx` (desktop principais):
- `<DesktopApp>` — router com 9 telas + `<DesktopSidebar active onChange>` reusável.
- Shared helpers: `<DesktopMain>`, `<DesktopAside>`, `<DesktopHeader>`, `<DesktopNavItem>`, `<DCalc>`, `<DStat>`, etc.

`desktop-states.jsx` (desktop variants):
- `<CenteredModal title width children footer>` — modal desktop centralizado.
- `<DesktopToast kind title body action>` — toast top-right base.
- `<DesktopToastProgress kind title body duration>` — toast com barra de progresso de auto-dismiss (animação `cfToastProgress` scaleX 1→0).
- `<DesktopToastCustom icon iconKind title body indeterminate>` — toast com ícone customizado e tint variável (`brand|eur|brl|danger`); `indeterminate` mostra barra animada infinita pra estados de loading.
- `<DesktopToastUndo title body remaining>` — toast destructive com countdown numérico + barra de progresso clay + botão "Desfazer" brass.
- `<TabletApp>` — versão tablet do dashboard com sidebar compacto.

### Telas

- Mobile (`screens.jsx`): Dashboard, Lançar, Dívidas, Transações, Contas, Resumo, Recorrentes, Categorias, Mais.
- Mobile extras (`extras.jsx`): OnboardingLogin, OnboardingFirstAccount, OnboardingReady, NovaCategoriaSheet, NovaDividaSheet, RegistrarPagamentoSheet, MotionDemoScreen.
- Mobile iterations (`iterations.jsx`): EmptyDashboard, EmptyTransacoes, EmptyDividas, LoadingTransacoes, OfflineExchange, SyncWarning.
- Desktop (`desktop.jsx`): DesktopDashboard, DesktopLancar, DesktopTransacoes, DesktopDividas, DesktopContas, DesktopResumo, DesktopRecorrentes, DesktopCategorias, DesktopMais.
- Desktop states (`desktop-states.jsx`): DesktopStatesDemo (empty/loading/cambio/sync), DesktopModalsDemo (4 modal variants), DesktopToastsDemo (stack), TabletApp.

### Motion CSS

- `@keyframes cfFadeUp` 320ms — entrada de tela mobile.
- `@keyframes cfSheetIn` 280ms — slide-up de sheet mobile.
- `@keyframes cfModalIn` 220ms — scale-in de modal desktop.
- `@keyframes cfPulse` 600ms — pulse em número atualizado.
- `@keyframes cfToastIn` 280ms — slide-in de toast.
- `@keyframes cfToastProgress` linear — barra de progresso de auto-dismiss (scaleX 1→0).
- `@keyframes cfToastIndeterminate` 1.4s infinite — barra indeterminada para loading.
- `@keyframes cfShimmer` infinite — loading skeleton.
- `.cf-press` 80ms scale 0.97 — feedback de press.

Todos com `cubic-bezier(0.2, 0, 0, 1)`. Sem bounces.

---

## Caveats e próximos passos

Veja a mensagem ao final da geração — itens que precisam de validação do Owner antes de fechar.
