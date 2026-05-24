# Design System — Controle Financeiro

Sistema visual para o portal de finanças pessoal (uso do casal). Dark-mode-first, foco em densidade de dados e legibilidade numérica.

> Base reaproveitada de um design system fintech anterior. Toda a camada de gamificação (leagues, XP, badges, troféus, "leak hunt", "discipline score", FinCoin) foi removida — este projeto é um portal doméstico, não um SaaS.

---

## 1. O que sobrou e por quê

| Mantido | Motivo |
|---|---|
| `colors_and_type.css` | Tokens universais (cores, tipografia, espaçamento, raios, motion). Servem qualquer fintech. |
| `preview/` (cores, tipografia, espaçamento, componentes) | Cartões de referência visual para implementar UI. |

Removido: logos, badges de liga, ícones de troféu/coroa/gema, medalhas, screenshots de gamificação, UI kits do produto anterior (eram prototypes específicos do WalletHero, não código reaproveitável).

---

## 2. Identidade visual

- **Dark-mode-first.** Fundo padrão `--bg-base #0B0F19`. Sem light mode no v1.
- **Cartões empilhados sobre o palco.** `bg-base` → `bg-surface` → `bg-elevated` para hover.
- **Sem gradiente em fundo.** Vinheta sutil só permitida atrás de hero do dashboard.
- **Hairlines, não shadow.** Borda padrão `1px solid rgba(255,255,255,0.10)`. Shadow só em popovers/modais.
- **Glow é o destaque.** Reservado para "isto está vivo agora": ações primárias, alertas, números em foco.

### Uso de cor

| Token | Reservado para |
|---|---|
| `--primary` (teal `#00E5A0`) | Dinheiro a favor — saldo positivo, pago, sobra, CTAs primários |
| `--accent-purple` (amethyst) | Dívidas em destaque, ações secundárias importantes |
| `--accent-gold` | Caixinhas e reservas (uso funcional, não celebrativo) |
| `--danger` / `--leak` (vermelho) | Em atraso, alertas críticos |
| `--warning` (âmbar) | Pendente, vencimento próximo (≤3 dias) |
| `--success` (mint) | Pago, confirmado, em dia |
| `--fg1 / fg2 / fg3` | Hierarquia 3 níveis — título / corpo / meta |

**Regra:** dashboard ~80% neutro (slate + cinzas), ~15% teal (dinheiro = primário), ~5% status.

### Tipografia

- **Display** (Space Grotesk) — títulos, hero do dashboard
- **Body** (Manrope) — UI, parágrafos, labels
- **Mono** (JetBrains Mono) — **todo número** (valores, percentuais, datas tabulares)

Números são a tipografia herói deste app. `R$ 4.820,30` deve parecer manchete, não rodapé. Sempre `font-variant-numeric: tabular-nums` em valores monetários.

### Formato de número PT-BR

- BRL: `R$ 1.240,50` (ponto de milhar, vírgula decimal)
- EUR: `€ 1.240,50` (mesmo padrão)
- Negativos: sinal de menos + cor vermelha (`-R$ 320,00`), nunca parênteses
- Percentuais: 1 casa decimal quando importa, inteiros quando casual

### Espaçamento

Base 4px. Ritmo: 4 / 8 / 12 / 16 / 24 / 32 / 48.
Cartões: 20-24px desktop, 16px mobile. Linhas de tabela: 8-12px.

### Raios

- Inputs / botões pequenos: 10px
- Cartões padrão: 14px
- Hero cards: 18px
- Pills/chips: 999px

---

## 3. Vocabulário do produto (PT-BR)

| Use | Não use |
|---|---|
| Saldo atual | Cash position |
| Sobra prevista (fim do mês) | Surplus / cash left |
| Pago / Pendente / Em atraso | Confirmed / processing |
| Recorrente | Subscription |
| Parcela 3/10 | Installment |
| Dívida em aberto | Outstanding debt |
| Caixinha | Bucket / pot |
| Meta | Goal / target |
| Marcar como pago | Confirm payment |
| Lançar despesa | Add expense |

### Tom

- Direto, segunda pessoa ("você"), presente.
- Números concretos > frases vagas. *"Faltam R$ 320 para fechar o mês no positivo"* > *"Cuidado com os gastos"*.
- Sem emoji decorativo. Sem celebrações falsas.
- Casing: sentence case em tudo (*"Marcar como pago"*, não *"Marcar Como Pago"*).

---

## 4. Iconografia

[Lucide](https://lucide.dev) via CDN ou pacote npm — único sistema. Stroke 1.5px, rounded caps. 20px padrão, 16px em listas densas, 24px em nav. Cor segue texto (`--fg2`) salvo se representar status.

Sem emoji no chrome. Sem mistura stroke/filled.

---

## 5. Arquivos de referência

```
design-system/
├── README.md                 ← este arquivo
├── colors_and_type.css       ← tokens (importar em todo lugar)
└── preview/                  ← cartões de referência visual
    ├── colors-*.html
    ├── type-*.html
    ├── spacing-*.html
    └── comp-*.html
```

Abrir os HTMLs de preview num browser para ver os tokens renderizados.
