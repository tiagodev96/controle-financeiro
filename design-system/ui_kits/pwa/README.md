# UI Kit · PWA mobile

Recreação interativa do app mobile do Controle Financeiro em React + JSX inline. Três iPhones lado a lado mostram **Dashboard**, **Lançar despesa** e **Dívidas**. A nav inferior de cada phone é clicável — alterna entre as 3 telas dentro daquele phone.

## Estrutura

- `index.html` — entry point. Carrega React 18, Babel standalone, os 3 .jsx, monta o stage e gerencia o toggle dark/light/auto (persistido em `localStorage`).
- `ios-frame.jsx` — starter component (bezel iPhone com status bar, dynamic island, home indicator). Aceita `dark={boolean}`.
- `components.jsx` — primitives. Exporta `Icon`, `T` (tokens), `Num`, `HeroNumber`, `Editorial`, `Eyebrow`, `StatusPill`, `Btn`, `Card`, `CCY`, `fmt`, `fmtParts`. Todos os componentes consomem CSS variables — tema se aplica automaticamente.
- `screens.jsx` — telas e moléculas. Exporta `AppTopBar`, `BottomNav`, `DashboardScreen`, `LancarScreen`, `DividasScreen`.

## Tema

O toggle no topo escolhe **Dark · Light · Auto**. Ambos são primeira-classe — calibrados independentemente, não inversões automáticas. `Auto` segue `prefers-color-scheme`. A escolha é gravada em `localStorage('cf-theme')` e disparada via `CustomEvent('cf-theme')` para os componentes React reagirem (bezel do iPhone troca cor).

Em produção, a mesma estratégia se aplica: setar `data-theme` no `<html>` baseado em preferência salva (ou em "auto" no primeiro acesso).

## Como adaptar para produção

Em Next.js + Tailwind v4 + shadcn/ui, este kit serve como **referência de hierarquia, copy e proporção**, não como implementação literal:

1. Copie `../../colors_and_type.css` para `src/app/globals.css`.
2. Use shadcn primitives (`Button`, `Input`, `Card`) e estilize via tokens — não copie nossos `<Btn>`/`<Card>`.
3. Use `lucide-react` em vez dos SVGs inline em `components.jsx`.
4. Leia `screens.jsx` para entender a ordem dos blocos em cada tela e o tom dos labels — caps tracked sobre números-herói, mono pra meta inferior.

## Restrições conhecidas

- O drag-to-reorder de Categorias está visualizado (handle de pontinhos à esquerda) mas não tem implementação real de drag.
- O calendar strip de Recorrentes é informativo apenas — não tem interatividade (hover de dia, etc.) nesta iteração.
- Os SVGs inline em `Icon.*` são aproximações de Lucide; em produção, importe direto da lib.
- Sem efeitos de motion implementados além das transições CSS dos toggles e do focus ring — animações reais (transição entre telas, contador animado, etc.) ficam para a iteração seguinte.
