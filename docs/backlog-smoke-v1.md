# Backlog — smoke test v1.0 (produção)

Itens encontrados durante o primeiro smoke real em produção, após o deploy pós-MVP + brand color wine. Lista crua, sem priorização ainda. Fica aqui até virar PRs.

## Categorias

- **Criar categoria inline no /lancar**. Hoje se a categoria não existe, o usuário precisa sair do form (perdendo o que digitou), criar em /categorias, e voltar. Adicionar um chip "+ Nova" no final do chip selector que abre um mini-dialog inline com `name` + `kind` (inferido do `direction` corrente) e ao salvar: cria via action, adiciona ao state local de categorias, e seleciona a nova como ativa. Sem perder valor/descrição já digitados.

- **Selector de ícone no dialog "Nova categoria"**. Hoje a categoria é criada só com nome — o ícone é inferido por `iconForCategory(name)` (heurística baseada em palavras-chave). Permitir escolher explicitamente um ícone de uma grade Lucide (8-12 opções comuns) durante a criação. Editar categoria também deveria permitir trocar o ícone.

## Componentes / design system

- **Substituir `<select>` nativo por componente custom em todo o app**. Hoje campos "Conta", "Categoria" etc usam `<select>` HTML, que abre o dropdown nativo do OS — fundo branco, highlight azul Windows/Chrome, ignora tema dark e tokens do design system. Migrar pra Base UI `Select` (já instalado via `@base-ui/react`) ou Combobox shadcn, estilizado com os mesmos tokens (`bg-bg-raised`, `border-border-soft`, `text-fg1`, hover `bg-bg-inset`, focus ring `--ring`). Afeta: `lancar-form`, `recurring/create-dialog`, `installments/create-dialog`, `debts/register-payment-dialog`, `transaction-filters`, `edit-transaction-dialog`.

## Transações

- **Soma do header de `/transacoes` ignora currency**. Hoje `src/app/(app)/transacoes/page.tsx` agrega `amount_cents` cru de transactions em BRL e EUR e mostra o total prefixado com `€`. Ex.: R$ 58 + € 15 vira `−€ 73,00`. Corrigir: agregar por currency em mapa `{ EUR: cents, BRL: cents }` e exibir cada total separado (`−€ 15,00 · −R$ 58,00`). Aplicar mesma lógica pra income/expense breakdown da página. Não converter via fx aqui — a página lista transactions reais, não tem semântica de "total convertido".

- **Saldo da conta com toggle "atualizar saldo" no lançamento e na marcação como paga** (decisão tomada, implementar no lote 1.5):
  - Status (`pending` / `paid`) e "afetar saldo" são conceitos separados. Status fica como está. Adicionar input boolean `update_balance` (default `true` quando status=paid).
  - **Em `/lancar`**: quando `paid` está ligado, mostrar abaixo um segundo toggle "Atualizar saldo da conta" (default ON, label dinâmico: "abater do saldo" pra despesa, "somar ao saldo" pra entrada). Se desligado, transaction é criada com status=paid mas accounts.balance_cents fica intacto — útil quando o usuário já atualizou o saldo manualmente fora do app.
  - **Em /transacoes (botão de check inline para marcar como paga)**: troca o click silencioso por um pequeno popover ou prompt: "Marcar como paga e atualizar saldo? [Atualizar saldo / Só marcar]". Action `markPaidAction` recebe `updateBalance: boolean`.
  - Schema: sem alteração — o behavior é só na action (server). Quando `updateBalance && status='paid'`, a action atualiza `accounts.balance_cents` (expense: subtrai, income: soma). Se status volta pra `pending` num edit, reverte a operação se `updateBalance=true` foi usado antes. Cuidado com idempotência (não atualizar duas vezes).
  - Editar transação: se mudar amount/direction/account num lançamento já paid+updated, action precisa rebalancear (subtrair valor antigo, somar novo). Pode ser tricky — começar sem esse fluxo edit-rebalance e ver se vira problema.

## Sugestão de dívida

- **Card "Sugestão" não aparece quando deveria**. Caso real: saldo EUR €189,52, dívida EUR aberta de €100, sobra prevista (saldo + pendentes) €189,52, mas card não renderiza. Causa: `src/app/(app)/page.tsx` passa `sobraEurCents: stats.sobraPrevistaCents - balanceByCurrency.EUR` pro `computeDebtSuggestion`, ou seja, só o **delta** pendente_income - pendente_expense (que no caso é €0). O spec.md §6.3 define `sobraPrevistaEUR` como a sobra completa (saldo + delta) — usar `stats.sobraPrevistaCents` direto sem subtrair o balance. Fix de 1 linha em `page.tsx`. Adicionar teste unit nessa heurística cobrindo o caso.

- **Inconsistência de label em /resumo entre "Saldo previsto fim do mês" e "Sobra prevista"**. Hoje os 2 valores aparecem juntos — o primeiro é `saldo + delta` (per spec) e o segundo é só `delta`. Pro usuário, "sobra" sugere o número grande. Avaliar: renomear "Sobra prevista" pra "Variação prevista" (positivo/negativo), ou unificar pra mostrar só um número. Decisão tem que casar com o nome usado na heurística da sugestão de dívida.

## Recorrentes

- **Recorrente criada não gera transactions pendentes automaticamente**. PRD `recorrentes.md` define geração como manual via botão "Gerar este mês" em `/recorrentes`. Em produção isso é confuso — usuário cria regra e espera ver pending em `/transacoes` na hora. Opções: (a) gerar automaticamente a transaction do mês corrente (ou mês de `day_of_month` mais próximo no futuro) ao criar a regra; (b) gerar todas as N próximas (até `active_until` ou 12 meses); (c) manter manual mas mostrar toast "1 regra criada. Clique em **Gerar este mês** pra lançar a primeira parcela" mais óbvio. Recomendado: (a) — gera só a próxima parcela ao criar, restante segue manual ou cron mensal.

- **Cron mensal só gera mês corrente, não pula meses passados/atraso**. Hoje `runRecurringCron` itera households e chama `generateRecurringForMonthCore(monthIso: mêsAtual)`. Se o cron falhar 2 meses seguidos, fica lacuna. Idempotência cobre só o mês atual. Fallback ideal: ao executar, varre últimos 3 meses retroativos pra preencher gaps. Avaliar custo (são 3× queries × N households) vs valor.

## Parcelados

- **Input "Parcelas" e "A cada (meses)" clampam a cada keystroke**. Em `src/components/finance/installments/create-dialog.tsx` o `onChange` faz `Math.max(2, Math.min(60, Number(e.target.value)))`, que transforma `''` em `0 → 2` na hora. Resultado: usuário não consegue limpar o campo pra digitar "10" — começa com "2", apaga não dá, digita "1" vira 2, digita "0" vira "20" (porque "2" já tava lá). Acabou criando plano em 20× achando que era 10×. Fix: usar string como state interno, permitir vazio durante edição, clampar só em `onBlur` ou no submit. Mesma raiz no input de mesma natureza em `recurring/create-dialog.tsx` (`day_of_month`, min=1 max=28) — auditar e aplicar mesmo fix nos dois.

- **Editar parcelado**. Hoje o menu ••• só tem "Cancelar plano". PRD `parcelas.md` deixou edição explicitamente fora ("Editar valor/N/datas de plano existente — não. Cancela e recria."). Errar é comum (typo no título, categoria errada, valor errado) e ter que cancelar + recriar é fricção grande. Propostas em ordem de risco crescente:
  - **Baixo risco**: editar `title`, `notes`, `category_id`, `account_id`. Não toca em transactions já geradas (que mantêm seus próprios category_id/account_id materializados) — ou propaga pras pending. Decidir.
  - **Médio risco**: editar `total_amount_cents`. Recalcula só as parcelas **pending** (paid mantém valor original). Soma final pode divergir do total novo se já tem paid — mostrar warning.
  - **Alto risco**: editar `total_installments`, `first_due_date`, `frequency_months`. Reordena cronograma. Provavelmente continuar fora — recomendar cancelar+recriar.

  v1.1 entrega o nível baixo risco (title + notes + categoria + conta). Médio risco vira PRD separada se o owner pedir.

## Análogos (induzidos dos bugs acima)

Padrões prováveis no código com a mesma raiz dos bugs reportados. Não foram testados manualmente em prod ainda, mas a varredura do código sugere que existem:

- **Edit gap em dívidas e recorrentes** (mesmo padrão de parcelados). `src/components/finance/debts/list-item.tsx` e `recurring/list-item.tsx` só expõem ações de status/delete no menu •••. Não há "Editar" — usuário não consegue mudar `title`, `notes`, `priority` da dívida nem `title`, `amount_cents`, `day_of_month`, `category_id`, `account_id` da recorrente. Mesma frustração do parcelado. Aplicar mesmo critério de risco: campos não-estruturais editáveis; estruturais só com cuidado ou cancela+recria.

- **Clamping de input numérico só existe em installments**, mas a auditoria confirmou que `recurring/create-dialog.tsx` tem `<input type="number">` pra `day_of_month` (linha 173) **sem** o clamp — provavelmente sofre do problema oposto (aceita valores fora do range no input, valida só no submit). Comportamento dos dois deve ser unificado: `string` interno, validação no `onBlur` + submit.

- **Currency-mix em aggregação** só foi detectada na `/transacoes` page (header `expenseCents/incomeCents`). `src/lib/finance/dashboard-stats.ts` é seguro (já filtra por currency via `.eq('currency', currency)`). Não foram encontradas outras agregações ingênuas.

- **`/resumo` ignora transactions em BRL**. Mesma raiz da heurística da sugestão e do dashboard: hardcode `primary: Currency = 'EUR'`. Em households com transactions/entradas em BRL, esses valores **não entram** em `entradas`, `despesas`, `top categorias`, `sobra prevista` do resumo — `calculateMonthStats` e `topCategoriesThisMonth` são chamados com `currency='EUR'`. Solução: rodar por currency e consolidar via fx, OU mostrar 2 colunas de resumo (uma por moeda). Casa com o pedido de toggle EUR/BRL no resumo já anotado.

- **Restricted dropdown só em `/transacoes`** — `lastNMonths(6)`. Não há outros dropdowns de mês fechados pra auditar. Mas se o selector de mês entrar no `/resumo` (já no backlog), o mesmo problema vai reaparecer; planejar input aberto desde já.

- **Native `<select>` em 10 lugares de 6 arquivos**: `lancar-form`, `transaction-filters` (3 selects), `recurring/create-dialog` (2), `installments/create-dialog` (2), `debts/register-payment-dialog`, `edit-transaction-dialog`. Todos sofrem do mesmo problema visual do print que você mandou. Migrar todos pra Base UI Select de uma vez como uma frente própria.

- **Currency mismatch entre rule.currency e account.currency em recorrentes não é bloqueado**. Em `src/server/actions/recurring/core.ts`, ao criar regra, a currency vem do account (`account.currency`) mas nada impede mudar `account_id` no edit (se existir) sem rechecar. Como ainda não há edit, não é bug ativo, mas vai virar bug quando edit entrar. Garantir guard.

- **Cron mensal de recorrentes só roda o mês corrente** (já listado em "Recorrentes"). Caso paralelo: cron daily de fx não tem mesmo problema porque idempotência por dia é simples (`rate_date = today`). Mas se fx ficar offline por 3+ dias, ninguém revisita os gaps — fallback `getRate` cobre na primeira request do usuário, então aceitável.

- **`Math.ceil` na preview de parcela do dialog `installments/create-dialog`**. Linha 51-ish: `parcelaPreview = Math.ceil(totalCents / totalInstallments)`. Mostra valor preview pro usuário, mas o `splitInstallments` usado no submit distribui o resto entre as primeiras parcelas — o número exibido na preview pode divergir até em 1 cent da parcela real. Cosmético mas vale o fix: mostrar `splitInstallments(...)[0]` como "primeira parcela ~ X" e "última parcela ~ Y" se diferentes.

## Filtros / navegação

- **Filtro de mês em `/transacoes` é restrito a 6 meses passados + corrente**. Sem opção de meses futuros nem retroativos além de 6. Caso real: usuário criou recorrente com primeira parcela em jun/2026, transaction nasce com `occurred_on=2026-06-XX`, mas o dropdown só vai até mai/2026 — não tem como ver. Substituir o dropdown fechado por **input de mês/ano aberto** (`<input type="month">` nativo OU date picker mes/ano custom). Faixa razoável: `oldest_transaction.occurred_on` até `today + 24 meses`. Considerar o mesmo input em `/resumo` quando o selector de mês de lá entrar (já listado no backlog).

PRD original (`docs/prds/resumo-mes.md`) deixou explicitamente fora: export como imagem, selector de mês, comparativo. Lista de pedidos do smoke (**escopo confirmado pelo owner em 26/mai/2026**, vira `docs/prds/resumo-mes-v2.md`):

- **Compartilhar resumo como imagem (PNG)**, não texto puro. Gerar uma "mini dashboard" com os números-chave (saldo previsto, sobra, entradas/despesas, top categorias, dívidas abertas) num layout próprio pra WhatsApp. Caminho técnico recomendado: `@vercel/og` (Edge-rendered, oficial Next.js) gerando OG image dinâmica via route handler. Mantém o botão "Copiar texto" como fallback.
- **Selector de mês** (no mínimo mês corrente + mês anterior; ideal: passado e futuro). Mês passado mostra valores fechados (paid). Mês futuro projeta: soma das recurring rules ativas + parcelas previstas + dívidas em aberto. Sobra prevista vira "sobra projetada" pra meses futuros.
- **Selector de moeda do resumo** (EUR / BRL toggle no topo da página). Usa fxRateMap pra converter — não duplica queries. Saldo previsto, sobra, entradas, despesas e top categorias seguem a moeda selecionada; dívidas e contas mantém currency original.
