# Evolução — gastos por categoria e sobra mês a mês

## Problema

O app responde bem "como está este mês?" mas não "pra onde o dinheiro está indo ao longo do tempo?". O casal não consegue ver se Mercado vem crescendo há 4 meses ou se a sobra mensal está encolhendo — teria que abrir o resumo de cada mês e anotar. Sem visão de tendência, ajuste de hábito vira chute.

## Usuário afetado

O casal na conversa mensal de finanças (peso maior) e o owner em consultas pontuais de "essa categoria está saindo do controle?" (peso menor). Mobile-first, como todo o app.

## Métrica de sucesso

Sem métrica direta (uso pessoal). Proxy: responder "qual categoria mais cresceu no trimestre?" passa a custar uma visita a uma página, contra impossível hoje. Revisão qualitativa pelo owner após 2 meses.

## Escopo

### Dentro

- Página nova `/evolucao` acessível por tile em `/mais`.
- **Gráfico de gasto por categoria mês a mês**: últimos 6 meses, top 5 categorias por gasto total no período, linhas no recharts (mesma linguagem visual do balance-trend-chart). Valores convertidos pra moeda preferida da sessão via FX (gastos em moeda sem fx ficam fora, com aviso "parcial").
- **Gráfico de sobra mensal**: entradas − despesas pagas por mês, últimos 6 meses, derivado das transactions (não dos snapshots — snapshot é saldo, não fluxo).
- Lib pura/query `src/lib/finance/category-trend.ts` com testes de integração antes da UI.
- Extração de primitivos de chart compartilhados (tooltip, eixos, tokens) de `balance-trend-chart.tsx`, sem mudar o visual existente.

### Fora (explicitamente)

- Período configurável (12m, YTD) — v2; 6 meses fixo cobre o caso da conversa mensal.
- Evolução de saldo de contas — já existe em `/contas` (balance-trend-chart).
- Comparação contra orçamento/limite no gráfico — limites já têm card próprio no dashboard.
- Export/share da imagem do gráfico.
- Dados de dívidas e caixinhas.

## Abordagem proposta

Uma query agregada por (categoria, mês) sobre transactions de despesa dos últimos 6 meses, convertida cross-currency com o mesmo padrão de `cross-currency-stats` (fxIncomplete quando não dá). Sobra mensal idem com entradas. Server component monta as séries; client components recharts renderizam. Sem mudança de schema, sem dependência nova.

## Dependências

- R1 (`monthRangeFromIso`, `addMonths`, `MONTHS_PT_SHORT`) e R2 (`formatCents`) — entregues.
- recharts — já é dependência (balance-trend-chart).

## Riscos

- **Poucos meses de histórico** (app novo): certeza × baixo impacto → gráfico renderiza com os meses que existem; sem estado vazio especial além de "ainda sem dados suficientes" quando < 2 meses.
- **Categorias demais poluem o gráfico**: média × médio → top 5 do período + agrupamento implícito (resto fica fora; rodapé lista "outras: € X").
- **Custo da query** (6 meses de transactions): baixa × baixo → volume esperado < 1.2k linhas; agregação client-side no server component, mesmo padrão das stats.

## Hipóteses a validar

N/A: incremental sobre dados já coletados.

## Open questions

Nenhuma — visual segue o balance-trend-chart existente (tokens CSS, mono ticks, tooltip).
