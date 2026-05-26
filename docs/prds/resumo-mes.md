# Resumo do mês exportável

## Problema

Tiago e Laine fecham o mês conversando por WhatsApp ("entrou X, gastei Y em mercado, sobrou Z, dívida Jefferson caiu de 3k pra 2,4k"). Hoje o resumo é montado de cabeça: abrem dashboard, /transacoes, /dividas, fazem conta na calculadora, escrevem manualmente. Três efeitos:

1. **Mensagem demora 10-15 min pra montar** — fricção alta o suficiente pra pular meses.
2. **Erro de cabeça**: número arredondado, categoria esquecida, dívida não incluída.
3. **Rota /resumo já está no nav (sidebar + Mais) e dá 404** — promessa quebrada toda vez que clicam.

## Usuário afetado

- **Tiago no fim de cada mês** (peso alto, frequência mensal): abre /resumo no dia 28-31, confere os números, clica "Compartilhar", manda pra Laine no WhatsApp. Caso de uso principal.
- **Tiago pra si mesmo** (peso médio, eventual): copia o texto pra um Apple Note ou Obsidian como histórico pessoal. Lateral, não dimensiona a feature.

Não é pra: Laine sozinha (ela abre o app, vê dashboard, não pede resumo). Não é pra um contador (não é demonstrativo financeiro).

## Métrica de sucesso

**Tiago manda 2 resumos mensais consecutivos pra Laine via /resumo nos 60 dias após deploy** (ou seja: o mês de deploy + o seguinte). Medido por sample manual — pergunta direta a ele. Se ele manda 1 e volta a digitar no WhatsApp, o copy/formato ou a UX falhou. Se ele esquece de mandar, a feature não criou o hábito que substitui a planilha mental.

Proxy direto: abrir /resumo no dia 28-31 do primeiro mês pós-deploy e clicar "Compartilhar resumo".

## Escopo

### Dentro

**Página /resumo (server component)**:
- Header AppTopBar: eyebrow "{mês} · {ano}", título "Resumo do mês".
- **Card resumo visual** (espelha o que vai no texto exportado, com hierarquia tipográfica do design system):
  - **Saldo previsto fim do mês** em hero number (currency primária EUR — mesma convenção do dashboard).
  - **Sobra prevista** logo abaixo, com label "vs entradas - despesas previstas".
  - **Entradas vs Despesas do mês (paid)** em stat-pair: total entrado + total gasto + diff (positivo verde, negativo vermelho).
  - **Top 3 categorias gastas** (currency primária, paid + pending do mês corrente — reaproveita `topCategoriesThisMonth` com limit=3).
  - **Dívidas abertas**: lista de cada uma com `{title}: {currency} {remaining} restante` + se houve pagamento no mês corrente, `(pago este mês: {currency} {valorPagoMes})`. Reordenar por priority asc, remaining desc.
  - **Contas**: saldo atual de cada conta não-arquivada, agrupado por currency.
- **Botão primary brass "Compartilhar resumo"**: client component que chama `navigator.share({title, text})` com mensagem pré-gerada. Em browsers sem share API, faz fallback automático pra clipboard + toast "Resumo copiado".
- **Botão secondary "Copiar texto"**: sempre presente como segunda ação. Mesmo conteúdo, só clipboard.
- Empty state se household sem qualquer movimentação: card neutro "Sem dados pra resumir ainda." + CTA "Lançar primeira despesa".

**Geração da mensagem (server-side)**:
- Helper puro `buildMonthSummaryText({ now, accounts, debts, stats, topCategories, debtPaymentsThisMonth })` em `src/lib/finance/month-summary.ts`.
- Retorna string PT-BR formatada (texto puro, sem markdown, sem emoji). Quebras de linha simples (\n).
- Formato fixo:
  ```
  Resumo de maio · 2026

  Saldo previsto fim do mês: € 3.420,15
  Sobra prevista: € 280,40

  Entradas: € 2.800,00
  Despesas: € 1.520,60 (já pago: € 1.200,00, pendente: € 320,60)

  Top categorias:
  - Mercado: € 480,20
  - Restaurantes: € 215,90
  - Casa: € 180,00

  Dívidas abertas:
  - Jefferson: R$ 2.400,00 restante (pago este mês: R$ 600,00)
  - Cartão: R$ 320,00 restante

  Contas:
  - Itaú: R$ 1.820,00
  - Wise EUR: € 1.600,15
  ```
- Currency por item: dívida usa a currency da dívida, conta usa a currency da conta, métricas globais (saldo/sobra/entradas/despesas/top cats) usam a primária (EUR).
- Seções vazias são omitidas (sem "Dívidas abertas:" se zero abertas, sem "Top categorias:" se mês sem despesa).

### Fora (explicitamente)

- **Export como imagem** (canvas, html-to-image, screenshot estilizado) — PRD futura. Texto puro funciona em WhatsApp e é zero-dependência.
- **Histórico de resumos gerados** — re-gera on-demand a cada visita.
- **Comparativo com mês anterior** ("gastou 18% a mais em mercado que abril") — heurística boa mas pode enganar (mês com 5 vs 4 semanas, gasto sazonal). PRD futura.
- **Resumo semanal** ou de período arbitrário — só mensal v1.
- **Resumo de meses passados na UI** — só mês corrente. Selector de mês = PRD futura se aparecer dor real.
- **Email agendado** ("envia todo dia 1") — manual, abre o app, compartilha.
- **PDF / CSV / Excel** — sem caso de uso ainda.
- **Toggle "incluir seção X"** — defaultar a tudo é OK, omitir só vazias.
- **Conversão de moeda** entre dívidas EUR e contas BRL pra somar um único saldo — cada item na sua currency, sem agregado misturado.
- **Trend / sparkline** — nada visual de série temporal v1.

## Abordagem proposta

Server component em `/resumo` faz 3 queries em paralelo (accounts, debts, stats + topCats por currency), passa pra helper puro `buildMonthSummaryText` que gera a string. Renderiza o card visual com componentes existentes (HeroNumber, Num, CategoryProgressList, etc) e dois botões client (`<ShareButton>` + `<CopyButton>`) que recebem a string como prop e disparam Web Share / clipboard.

Helper de texto em `src/lib/finance/month-summary.ts` — função pura, totalmente unit-testável sem Supabase. Recebe dados já carregados, retorna string. Testes unitários cobrem: formato base, omissão de seções vazias, currency mistura (EUR primário + dívidas BRL).

Pagamentos por dívida no mês: query simples agregando transactions com `source_debt_id IN (...) AND paid_on >= start AND paid_on < end`, agrupada por debt_id. Helper `sumDebtPaymentsThisMonth` em `src/lib/finance/debts.ts`.

## Dependências

- **Helpers existentes**: `calculateMonthStats`, `topCategoriesThisMonth` (em `dashboard-stats.ts`), `listDebtsForHousehold` (já entregue), `listAllAccountsForHousehold`.
- **Web Share API + Clipboard API**: nativas em iOS Safari 14+ e Android Chrome. Sem polyfill.
- **Sonner**: toast pra feedback de "Resumo copiado" (já montado no AppLayout).
- **Nada novo**: sem migration, sem RLS adicional, sem dependência externa.

## Riscos

- **Web Share API negada pelo usuário** (cancela o picker): probabilidade alta, impacto baixo (operação silenciosa, sem erro mostrado). Mitigação: `try/catch AbortError` e não emite toast em cancelamento.
- **Web Share API ausente em desktop ou navegador antigo**: probabilidade média (Tiago às vezes abre no PC), impacto baixo (fallback automático pra clipboard com toast). Mitigação: detectar `'share' in navigator` antes de chamar.
- **Texto exportado fica longo demais pra WhatsApp** (limite ~65535 chars, mas legibilidade quebra antes): probabilidade baixa pra household pequeno, aceitar. Se virar problema, truncar Top categorias e limitar Dívidas a 5.
- **Saldo previsto fim do mês confunde Laine** (não é "quanto vou ter" — é "quanto vou ter SE pagar tudo que está pendente"): probabilidade média, impacto médio (mensagem ruim gera dúvida em vez de clareza). Mitigação: label completa "Saldo previsto fim do mês" — explícito que é projeção.
- **Currency mismatch confunde**: total "Despesas" só agrega EUR, mas dívidas listam BRL. Probabilidade média (Laine pode achar que dívidas BRL deveriam entrar no total). Mitigação: copy "Entradas / Despesas" implícito EUR (não dizemos), seção "Dívidas" lista currency explicita por item. Validar com Laine real.
- **clipboard.writeText rejeitado por permissão**: probabilidade baixa (HTTPS + user gesture cobrem), impacto médio (toast de erro). Mitigação: `try/catch` + toast "Não foi possível copiar".

## Hipóteses a validar

- **"Texto puro é suficiente pra WhatsApp"**. Premissa: Laine não pede formato bonito/imagem. Validar nas primeiras 2 mensagens — se ela responder "manda print que fica mais legível", PRD de imagem sobe.
- **"Saldo previsto + sobra prevista são as duas métricas que importam pra Laine"**. Premissa: já se discute saldo/sobra no chat de hoje. Validar — se ela perguntar "mas e o saldo atual real?", adicionar.
- **"Top 3 categorias é suficiente"**. Premissa: top 3 cobre 60-70% do gasto típico. Se ela pedir top 5/7 ou "e tudo que sobra junto em Outros", repensar.
- **"Mês corrente é o que faz sentido — não mês anterior fechado"**. Tiago manda durante o mês ou no fim? Se mandar dia 28-31, mês corrente faz sentido (já tem quase tudo). Se mandar dia 5 do mês seguinte, ele quer mês anterior. **Validar antes de buildar**.

## Open questions

- **Mês corrente ou mês anterior?** Quando Tiago abre /resumo, ele quer ver maio (corrente) ou abril (fechado)? → Resposta proposta: **corrente**, porque (a) dashboard já mostra corrente, (b) ele provavelmente abre dia 28-31. Confirmar.
- **Botão "Compartilhar" usa Web Share API?** Ou abre direto link `whatsapp://send?text=...`? → Resposta proposta: **Web Share API**, mais agnóstico (Laine pode estar em Signal, Telegram), fallback clipboard. Confirmar.
- **Order das dívidas no texto**: priority asc + remaining desc (igual /dividas) ou só remaining desc? → Resposta proposta: **priority asc + remaining desc**, consistência com /dividas. Confirmar.
- **Incluir seção "Em atraso" se houver?** Dashboard mostra. Resumo manda esconder ou destacar? → Resposta proposta: **destacar**, adicionar linha "Em atraso: € X,YY (N transações)" entre Despesas e Top categorias, só se overdue > 0. Confirmar.
- **Saldo previsto fim do mês = mesma fórmula do dashboard?** Dashboard: balance + pending income - pending expense. Pra /resumo: igual? → Resposta proposta: **sim, idêntico**, evita divergência conceitual. Confirmar.
- **Pagamentos por dívida no mês: contar só `paid` ou `paid + pending`?** → Resposta proposta: **só `paid`** (status=paid, paid_on no mês). Pending de pagamento de dívida é raro e confunde. Confirmar.
- **Empty state**: mostrar botão "Compartilhar" mesmo sem dados? → Resposta proposta: **não**, sem dados não há o que compartilhar. CTA "Lançar primeira despesa". Confirmar.
