# Cartão de crédito (credit_cards)

## Problema

owner passou a usar cartão de crédito e não tem onde lançar essas compras. As duas saídas
que o app oferece hoje estão erradas:

1. **Lançar como despesa normal na conta**: o saldo previsto cai na data da compra, mas o
   dinheiro só sai no dia 11. Uma compra de 08/ago aparece derrubando agosto quando na
   verdade derruba setembro. A projeção de fim de mês — o número central do produto — mente.
2. **Não lançar**: o gasto some do app. A sobra prevista fica otimista e, no dia 11, aparece
   uma saída de valor desconhecido.

Junto disso: sem agrupamento por fatura, não dá pra responder "quanto vou pagar dia 11?" nem
"quanto do meu mês que vem já está comprometido em parcela de cartão?".

## Usuário afetado

- **owner lançando compra** (peso alto, várias vezes por semana): "gastei R$ 120 no mercado
  no cartão". É o fluxo que precisa ser mais rápido — mesma velocidade do `/lancar` atual.
- **owner conferindo a fatura antes do vencimento** (peso médio, mensal): "quanto fecha essa
  fatura?" e "as compras batem com o app do banco?".
- **owner decidindo parcelamento** (peso médio, algumas vezes por mês): "consigo colocar isso
  em 6× sem afundar os próximos meses?".

Não é pra: controle de rotativo/juros, cartão de terceiros, conciliação automática com o
banco.

## Métrica de sucesso

**Por 2 ciclos seguidos, o total da fatura no app bate com o valor cobrado pelo banco no dia
11 com diferença menor que R$ 5.** Medido à mão, comparando a fatura em `/cartoes` com o
extrato no dia do vencimento.

Isso mede as duas coisas ao mesmo tempo: que owner está lançando as compras (senão não bate)
e que o ciclo de fatura está calculado certo (senão a compra cai na fatura errada).

Proxy secundário: a sobra prevista do mês de vencimento passa a refletir a fatura sem
ajuste manual.

## Escopo

### Dentro

**Cadastro do cartão**:
- `/cartoes` com CRUD: nome, dia de fechamento, dia de vencimento, conta que paga a fatura,
  limite (opcional), arquivar.
- Cartão do owner: fecha dia 7, vence dia 11. O dia do fechamento é exclusivo: compra a
  partir do dia 7 já cai na fatura seguinte. Consequência: **dia 7 é o melhor dia pra
  comprar** (35 dias até pagar) — a UI mostra isso.

**Lançar compra** (dentro do `/lancar` existente):
- O campo "Conta" vira "Pagar com" e lista contas e cartões juntos.
- Escolhendo cartão: "Data" vira "Data da compra", aparece "Parcelas" (1–24) e o aviso
  "1ª vence 11/09". Somem os toggles "Já pago" e "Atualizar saldo" — compra no cartão nasce
  sempre pendente.
- Parcelamento reusa `installment_plans`; o plano guarda o cartão e a 1ª parcela vence na
  fatura do ciclo da compra.

**Fatura**:
- Fatura é derivada, não tem tabela: é o conjunto de transactions do cartão com o mesmo
  vencimento.
- `/cartoes` mostra a fatura aberta (ciclo em andamento), a fatura fechada a pagar e permite
  navegar por mês. Lista as compras de cada fatura.
- "Pagar fatura": marca todas as compras daquele vencimento como pagas e debita a conta **uma
  vez** pelo total, numa operação atômica.

**Visibilidade**:
- Pill `CARTÃO` em `/transacoes` com a data real da compra no sublabel; parcela no cartão
  mostra os dois pills.
- Filtro por cartão em `/transacoes`.
- Bloco no dashboard: fatura aberta, fatura a pagar, limite disponível (se houver limite) e
  **comprometido** — soma das parcelas do cartão que vencem além da próxima fatura.
- Nav: Cartões assume o slot 4 da bottom nav; Dívidas desce pra `/mais`.

### Fora (explicitamente)

- **Rotativo, juros e pagamento parcial de fatura** — não. O modelo assume que a fatura é paga
  integralmente. Pagar parcial exigiria estado de fatura no banco, que este desenho evita de
  propósito.
- **Estorno / crédito na fatura** — não v1. Lançar como entrada avulsa e aceitar que a fatura
  do app fica maior que a do banco naquele ciclo.
- **Antecipação de parcelas** — não. Cancela o plano e recria, igual `/parcelados` hoje.
- **Conciliação com extrato / import de OFX** — não. Contraria a decisão de "sem importação
  histórica".
- **Cartão com moeda diferente da conta de pagamento** — bloqueado. A moeda da compra vem da
  conta, como já acontece em toda transaction.
- **Fechamento manual de fatura** ("fechar agora") — não. O ciclo é puramente calculado a
  partir de `closing_day`.
- **Cartão adicional por membro do household** — não. O household inteiro vê o mesmo cartão.
- **Anuidade automática** — não. Cadastrar como recorrente normal.
- **Alerta de vencimento por push** — fora, junto com o resto de push.

## Abordagem proposta

**O cartão não é uma `account`.** `accounts` é carteira com saldo manual, e esse saldo entra
inteiro na projeção — um cartão ali obrigaria a excluí-lo de vários pontos de soma, e cada
esquecimento vira erro silencioso no saldo.

Em vez disso o cartão é uma **etiqueta na transaction**: `account_id` continua apontando pra
conta que vai pagar a fatura, `credit_card_id` marca a compra, `purchased_on` guarda a data
real, e `occurred_on` recebe a **data de vencimento da fatura** do ciclo.

O ganho é que a compra já nasce como despesa pendente do mês em que o dinheiro sai, então
`projectMonth` e `calculateCrossCurrencyMonthStats` continuam corretos **sem nenhuma
mudança**. E a fatura vira um `group by occurred_on`, sem tabela nova — mesma filosofia de
"parcela não tem tabela, é transaction com `installment_number`".

Alternativa descartada: tabela `card_purchases` separada com uma única transaction "Fatura
cartão" por mês. Menos ruído em `/transacoes`, mas joga categorias e parcelas do cartão pra
fora de toda a máquina existente — teria que duplicar agregação por categoria, filtros e
edição de lançamento.

## Dependências

- **Schema**: precisa de migration nova (`credit_cards`, 2 colunas em `transactions`, 1 em
  `installment_plans`, RPC de pagamento de fatura).
- **`/lancar`**: é o form mais usado do app e vai ganhar um modo novo. Risco de regressão
  concentrado ali.
- Nada externo. Sem dependência de API, de terceiro ou de decisão pendente.

## Riscos

- **Compra aparece no mês "errado" pro usuário**: probabilidade alta, impacto médio. Uma
  compra de 08/ago cai no grupo de setembro em `/transacoes` e conta como despesa de setembro
  em "Top categorias". É correto pra fluxo de caixa e é o ponto do desenho, mas contraintuitivo
  na busca. → Mitigação: pill `CARTÃO` com a data da compra visível, filtro por cartão, e
  `/cartoes` organizado por data de compra. Aceitar o resto.
- **Fatura infla `/transacoes`**: probabilidade alta, impacto baixo. 20-40 compras por ciclo
  viram 20-40 linhas. → Filtros já existem; aceitar.
- **Data de compra retroativa cruzando fechamento**: probabilidade média, impacto médio.
  Lançar no dia 9 uma compra feita no dia 6 muda a fatura de destino. → O cálculo usa
  `purchased_on`, não a data de lançamento; o form mostra o vencimento resultante antes de
  salvar.
- **Clamp de dia em mês curto**: probabilidade baixa (o cartão do owner é 7/11), impacto alto
  se acontecer. Cartão que fecha dia 31 não tem dia 31 em fevereiro. → Reusar
  `addMonthsClamped`, com teste unitário dedicado.
- **Pagamento de fatura não-atômico**: probabilidade baixa, impacto alto (saldo debitado sem
  as compras virarem pagas, ou o contrário). → RPC única no Postgres, no padrão de
  `create_paid_transaction_with_coverage`.
- **Regressão no `/lancar`**: probabilidade média, impacto alto. → Testes de componente do
  modo cartão + os E2E de despesa/entrada que já existem seguem verdes.

## Hipóteses a validar

- **"owner vai lançar a compra na hora"**: se ele deixar acumular e lançar tudo no fim do
  ciclo, a fatura fecha certa mas a sobra prevista fica otimista o mês inteiro. Se em 4
  semanas o padrão for lançamento em lote, repensar (talvez valha um lançamento rápido de
  fatura inteira).
- **"uma fatura por cartão por mês é suficiente"**: assume pagamento integral. Se ele começar
  a pagar parcial, o modelo não cobre e precisa de repensada estrutural.

## Open questions

- **Compra no cartão pode ser marcada como paga individualmente em `/transacoes`?**
  → Resposta proposta: **sim**, sem tratamento especial — é uma transaction pendente como
  qualquer outra. Quem pagar a fatura inteira depois só marca o que sobrou. Confirmar.
- **O que acontece com as compras quando um cartão é deletado?**
  → Resposta proposta: `on delete set null` no `credit_card_id`, virando lançamentos avulsos
  (mesma escolha de `/parcelados`). Confirmar.
- **Limite é obrigatório?**
  → Resposta proposta: **opcional**. Sem limite, o KPI "limite disponível" simplesmente não
  aparece. Confirmar.
- **A fatura aberta entra na sobra prevista do mês corrente?**
  → Ela entra no mês do **vencimento**, que pode ser o corrente ou o seguinte dependendo do
  dia. É consequência automática do desenho, não uma escolha — registrar e observar se
  confunde na prática.
