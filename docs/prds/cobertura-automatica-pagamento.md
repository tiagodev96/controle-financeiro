# Cobertura automática de pagamento entre contas

## Problema

Quando o owner paga uma despesa numa moeda em que a conta correspondente não
tem saldo suficiente, a conta fica negativa — mesmo quando há dinheiro de sobra
em outra conta (na mesma moeda ou em outra). Na vida real isso não acontece: o
owner converte/transfere o necessário e paga. Hoje o app força um registro
manual em dois passos (ajustar saldo / lançar conversão na mão) ou aceita um
saldo negativo que não reflete a realidade.

Exemplo concreto: tenho €100 e R$0. Pago R$12. O esperado não é ficar R$ −12 —
é abater €2 da conta em euro (euro a R$6) e a conta em real terminar em 0.

## Usuário afetado

Owner (e membros do household) no momento de **lançar uma despesa já paga** ou
de **marcar uma pendência como paga**, pela PWA no celular. Contexto de maior
peso: pagamento do dia a dia em R$ quando o caixa imediato está em € (ou
vice-versa). Não afeta: lançamento de entrada (income), nem despesas que
permanecem pendentes (não tocam saldo até serem pagas).

## Métrica de sucesso

Sem métrica de produto formal (app pessoal, household de 2 pessoas). Critério
operacional:

- **Zero saldos negativos espúrios**: quando houver fundos suficientes somando
  as demais contas, nenhuma conta termina negativa após um pagamento.
- O owner deixa de registrar conversões manualmente para cobrir pagamentos.

Proxy observável: nº de ajustes manuais de saldo (`setAccountBalanceAction`)
feitos logo após um pagamento cai a ~0.

## Escopo

### Dentro

- Ao pagar uma despesa (no lançar com `paid=true & updateBalance=true`, e no
  marcar-como-paga), detectar se a conta da despesa ficaria negativa.
- Cobrir o **déficit** (`max(0, valor − saldo_da_conta_antes)`) puxando de outras
  contas ativas do household, na ordem: **mesma moeda primeiro**, depois
  **conversão** de contas em outra moeda pelo câmbio da data do pagamento.
- **Cobertura parcial**: drenar cada origem até cobrir o déficit ou esgotar
  saldo. Se o total disponível não cobrir, o restante fica negativo na conta da
  despesa (comportamento atual nesse caso de borda).
- Registrar cada cobertura como um lançamento de **movimentação entre contas**
  (transferência quando mesma moeda; conversão quando moedas diferentes, com taxa
  registrada), debitando a origem e creditando a conta da despesa. A despesa
  original permanece intacta na sua conta e moeda.
- Reversão consistente: ao **desmarcar como paga**, **editar valor/conta de uma
  despesa paga** ou **excluir** uma despesa paga, as movimentações de cobertura
  geradas por ela são revertidas (saldos restaurados) e os registros removidos.
- Excluir as movimentações de cobertura das estatísticas de receita/despesa
  (`dashboard-stats`, `cross-currency-stats`, `month-projection`) — elas são
  neutras no fluxo de caixa, só deslocam saldo entre contas.
- Exibir as movimentações de forma legível em Transações e no extrato da conta.

### Fora (explicitamente)

- **Transferência/conversão manual entre contas** como feature autônoma (botão
  "transferir"). A tabela criada aqui pode suportar isso depois, mas a UI de
  criar transferência à mão não entra agora.
- **Escolher a origem manualmente** no momento do pagamento (já decidido:
  automático, mesma moeda primeiro). Sem tela de confirmação de origem.
- **Otimizar qual origem usar** além da regra simples (mesma moeda → outra
  moeda, em ordem determinística). Sem heurística de "melhor câmbio" ou de
  minimizar conversões.
- **Cobertura de despesa que continua pendente** (sem pagamento) — não toca
  saldo, então não dispara nada.
- **Mais de duas moedas**: o modelo é genérico, mas só BRL/EUR existem e só esse
  par é testado.

## Abordagem proposta

Extrair a lógica de pagamento-com-cobertura para uma função pura testável em
`src/lib/finance/` que, dado (conta da despesa, valor, saldos das contas do
household, mapa de câmbio), devolve a lista de movimentações de cobertura a
aplicar e os deltas de saldo por conta. As server actions (`create-core`,
`mark-paid-core`) chamam essa função, persistem despesa + movimentações + saldos
numa sequência, e linkam as movimentações à transação de origem.

Novo conceito de dados: tabela `account_transfers` (RLS por household), com
`from_account_id`/`to_account_id`, `from_amount_cents`/`to_amount_cents`,
`from_currency`/`to_currency`, `rate` (nulo quando mesma moeda), `occurred_on`,
`source_transaction_id` (FK para a despesa que originou; `on delete cascade`
limpa o registro, mas a **reversão de saldo é feita em código**, não pelo
cascade) e `kind` derivado (`transfer` | `conversion`).

Algoritmo de cobertura (déficit em moeda da conta da despesa):

1. `deficit = max(0, valor − saldo_antes_da_conta_despesa)`. Se 0, fluxo atual.
2. Origens candidatas = contas ativas do household, exceto a da despesa, com
   saldo > 0. Ordenar: mesma moeda primeiro, depois outras; dentro de cada grupo
   por `sort_order` (default sugerido — ver Open questions).
3. Para cada origem, enquanto `deficit > 0`:
   - Mesma moeda: `cobre = min(deficit, saldo_origem)`; transfer 1:1.
   - Outra moeda: disponível na moeda da despesa = `convert(saldo_origem,
     taxa_origem→despesa)`; `cobre = min(deficit, disponível)`; debita da origem
     `convert(cobre, taxa_despesa→origem)`; conversão com `rate` registrada.
   - Gera uma movimentação, abate `deficit`, reduz saldo da origem.
4. Aplica: despesa debita o valor cheio da conta; cada movimentação credita a
   conta da despesa e debita a origem. Conta da despesa termina em
   `saldo_antes − valor + cobertura_total` (= 0 se totalmente coberta).

Câmbio: usar `getRateMap` na **data do pagamento** (`paid_on`; para despesa já
paga no lançar, a data da transação). Mesma fonte/cacheamento já existentes
(`fx_rates_cache`, banker's rounding em `convertCents`).

## Dependências

- FX disponível (`getRate`/`getRateMap`). Se o câmbio estiver indisponível e for
  necessário converter, o pagamento **não pode** silenciosamente errar o saldo —
  ver Riscos.
- Migration de schema aplicada em local e prod (atenção ao desalinhamento de
  tracking de migration em prod já anotado na memória do projeto).

## Riscos

- **Câmbio indisponível no momento da conversão**: baixa prob. × alto impacto
  (saldo errado). Mitigação: se a cobertura exigir conversão e `getRateMap`
  falhar (sem cache válido), abortar a cobertura cross-currency e cair no
  comportamento atual (conta fica negativa) com feedback claro — nunca gravar
  conversão sem taxa. Cobertura same-currency não depende de FX e segue.
- **Reversão incompleta** ao editar/excluir/desmarcar despesa paga: média ×
  alto. Mitigação: testes de integração cobrindo cada caminho de reversão;
  movimentações sempre linkadas via `source_transaction_id`.
- **Dupla contagem em estatísticas**: média × médio. Mitigação: stats nunca leem
  `account_transfers`; testes de integração afirmam que receita/despesa do mês
  não muda por causa de uma cobertura.
- **Atomicidade**: Supabase não dá transação multi-statement trivial via JS
  client. Risco de estado parcial se uma das escritas falhar. Mitigação:
  encapsular em uma função RPC Postgres (plpgsql) que faz despesa +
  movimentações + saldos numa transação única — ou aceitar e documentar a ordem
  de escrita + verificação. Decidir na fase de plano.

## Hipóteses a validar

- Assumimos que "mesma moeda primeiro" é sempre o desejado. Para o household
  atual (tipicamente 1 conta por moeda) isso raramente gera ambiguidade. Se no
  uso real surgir preferência por conta específica, revisitar a ordem de
  drenagem.

## Decisões (resolvidas com o owner)

1. **Ordem de drenagem**: por `sort_order` (a ordem definida na tela de contas),
   drenando uma conta por vez. Mesma moeda antes de outra moeda.
2. **Nome do conceito na UI**: "Conversão" (cross-currency) e "Transferência"
   (mesma moeda), um único tipo de linha em Transações.
3. **Editar valor de despesa paga com cobertura**: **recomputar** — reverte as
   coberturas antigas e recalcula com o novo valor.
4. **Atomicidade**: **RPC plpgsql** — despesa + movimentações + saldos numa
   transação Postgres única (tudo ou nada), via nova migration de função.

## Critérios de aceite (por camada de teste)

Seguindo o TDD outside-in do projeto.

### E2E (Playwright)
- Com €100 e R$0, lançar despesa paga de R$12 → conta R$ fica R$ 0,00, conta €
  fica € 98,00, aparece uma linha de conversão (€2 → R$12) em Transações.
- Com R$5 e €100, pagar R$12 → conta R$ fica 0, conta € abatida do equivalente a
  R$7 (cobertura parcial mista: usa os R$5 próprios + converte o resto).
- Marcar uma pendência em R$ como paga com conta R$ insuficiente dispara a mesma
  cobertura.
- Excluir a despesa paga reverte a conversão (saldos voltam a €100 / R$0).

### Integração (Vitest + Supabase local)
- `createTransactionForSession` com `paid=true` e déficit gera linha(s) em
  `account_transfers` e saldos corretos; same-currency antes de cross.
- `markPaidCore` idem.
- Reverter (desmarcar / excluir / editar valor) restaura saldos e remove
  movimentações.
- Estatísticas do mês (receita/despesa) não mudam por causa de uma cobertura.
- RLS: household não enxerga `account_transfers` de outro household.
- Câmbio indisponível com cobertura cross-currency: não grava conversão sem taxa
  (cai no comportamento atual + feedback).

### Unit (Vitest, `src/lib/`)
- Função pura de cálculo de cobertura: déficit zero (sem movimentação); cobertura
  total same-currency; cobertura total cross-currency; cobertura parcial mista;
  cobertura insuficiente (sobra negativo); múltiplas origens; arredondamento
  (banker's rounding) na conversão.

### Componente (RTL)
- N/A direto: a UI de pagamento é validada por E2E. Só extrair componente client
  se surgir lógica de exibição não trivial da linha de conversão.
