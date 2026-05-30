# Meta de quitação de dívida ("Quitar até")

## Problema

Hoje uma dívida no app é só "quanto falta". Não há nenhuma noção de **quando** o
dono quer ver aquilo zerado. Sem isso, a pessoa paga no improviso: não sabe se o
valor que vem pagando por mês chega na data que ela tem na cabeça, nem percebe
quando um prazo que ela mesma estipulou está passando. A informação de prazo vive
fora do app (cabeça, planilha, contrato) e nunca encosta no número que o app já
mostra. Resultado: a dívida arrasta sem que o app ajude a fechar.

## Usuário afetado

O dono do household acompanhando dívidas em aberto, em dois momentos:

- **Ao cadastrar/editar uma dívida** (peso menor, pontual): quer registrar "quero
  isso quitado até dezembro".
- **No uso diário do dashboard** (peso maior, recorrente): quer ser lembrado de
  prazos chegando perto ou já estourados, sem precisar abrir a tela de dívidas.

Não é para: dívidas fechadas, nem para quem não estipula meta (campo é opcional e
a feature degrada para o comportamento atual quando ausente).

## Métrica de sucesso

Sem analytics instrumentado no projeto (uso pessoal, 1–2 usuários). Métrica
honesta = **proxy comportamental observável pelo próprio dono**:

- Dívidas em aberto com meta definida > 0 após 2 semanas de uso (a feature é vista
  e usada).
- O card "Metas de quitação" no dashboard mostra estado coerente: uma dívida cujo
  prazo passou aparece como `atrasada`; uma com ritmo real abaixo do necessário
  aparece com projeção posterior à meta.

Se o dono nunca preenche o campo em 2 semanas, a hipótese de valor está errada
(ver Hipóteses) e a feature vira código morto — revisar.

## Escopo

### Dentro

- Campo **"Quitar até"** (opcional) no form de criar e editar dívida.
  Granularidade **mês/ano** (ex.: dez/26), persistido na coluna **`target_quit_date`
  já existente** (gravar como último dia do mês escolhido). Sem migration nova.
- `DebtRow` (em `src/lib/finance/debts.ts`) passa a selecionar `target_quit_date`.
- Zod de create e update aceita o campo (mês/ano → date, ou null).
- Função pura nova em `src/lib/finance/debt-deadline.ts`:
  - `monthsUntil(deadline, today)` — meses inteiros restantes (≥0; negativo se passou).
  - `requiredMonthlyCents(remainingCents, monthsLeft)` — ritmo necessário.
  - `projectedQuitDate(remainingCents, actualMonthlyCents, today)` — data real
    estimada no ritmo atual.
  - `deadlineStatus(...)` → `'on-track' | 'tight' | 'overdue'`.
- **Ritmo real**: média de pagamentos/mês da dívida, derivada das `transactions`
  com `source_debt_id`, `status='paid'`, sobre os meses decorridos desde o primeiro
  pagamento (ou desde a criação, se nenhum pagamento). Agregação em
  `src/lib/finance/debts.ts` (nova função, ex. `debtPaymentPace`).
- Na linha da dívida (`list-item.tsx`): linha de meta ("Quitar até dez/26 · faltam
  6 meses"), ritmo necessário, e chip de status quando `tight`/`overdue`. Quando há
  ritmo real, comparação ("necessário X/mês · seu ritmo Y/mês · fecha mar/27").
- No dashboard (`InsightsBlock`): card **"Metas de quitação"** listando dívidas
  abertas com meta **vencendo em ≤60 dias ou já vencida**, ordenadas por urgência
  (vencidas primeiro, depois mais próximas). Não renderiza se a lista for vazia.

### Fora (explicitamente)

- Migration de schema. A coluna existe; só passa a ser usada.
- `target_installments` (também já existe na tabela, segue sem uso aqui).
- Notificação push / e-mail de prazo. O lembrete vive no dashboard, passivo.
- Recalcular prioridade da dívida automaticamente a partir do prazo. Prioridade
  segue manual; prazo é sinal independente.
- Alterar a heurística de sugestão de sobra (`computeDebtSuggestion`). Prazo **não**
  entra na sugestão de quanto pagar nesta entrega (candidato a follow-up).
- Granularidade de dia exato. Mês/ano fechado.
- Bloquear/avisar na criação se a meta for "impossível" (ritmo necessário absurdo).
  Mostramos o número; não julgamos.

## Abordagem proposta

Reaproveitar `target_quit_date`. Toda lógica derivada (meses restantes, ritmo
necessário, ritmo real, projeção, status) sai como **funções puras** em
`src/lib/finance/debt-deadline.ts` (testáveis unit, alvo 95% coverage do diretório
`lib/`). O ritmo real reusa o padrão já existente de somar `transactions` por
`source_debt_id` (ver `sumDebtPaymentsThisMonth`), generalizado para média sobre N
meses. UI consome os derivados; nenhuma regra de negócio em componente. Picker de
mês/ano simples (dois selects mês + ano, ou input controlado) — sem dependência nova.

Estados de status:

- `overdue` (clay): `target_quit_date < hoje` e dívida aberta. Mantém a data e
  oferece CTA de repactuação ("definir novo prazo") na linha da dívida e no card do
  dashboard — reusa o edit dialog focando o campo de prazo. Não força modal; é um
  convite, não um bloqueio.
- `tight` (amber): faltam ≤2 meses **ou** projeção no ritmo real cai depois da meta.
- `on-track` (neutro): demais casos com meta; ou sem meta (não exibe chip).

## Dependências

Nenhuma externa. Tudo em código próprio + tabelas que já existem (`debts`,
`transactions`). Sem dependência de FX nova (ritmo é por moeda da dívida).

## Riscos

- **Ritmo real ruidoso com poucos pagamentos**: 1 pagamento em 1 mês → média
  enganosa, projeção instável. Prob. alta × impacto médio → exibir comparação de
  ritmo só com ≥2 meses de histórico; abaixo disso, mostrar só o ritmo necessário.
- **Mês como `date` e fuso**: gravar último dia do mês em UTC e comparar sempre por
  string ISO `YYYY-MM-DD` (padrão já usado no projeto para `occurred_on`), nunca via
  `Date` local, pra evitar off-by-one de timezone. Prob. média × impacto médio →
  cobrir com teste unit de borda (virada de mês/ano).
- **Card do dashboard competindo por atenção** com "Próximos 7 dias" e destino da
  sobra. Prob. média × impacto baixo → limiar de ≤60 dias mantém o card raro;
  ordenar por urgência e só mostrar o essencial por linha.

## Hipóteses a validar

- **O dono pensa dívida em termos de prazo-alvo.** Se ele nunca preenche "Quitar
  até", a feature não é vista. Validação barata: é o próprio dono construindo —
  feedback imediato no primeiro uso real.
- **Ritmo necessário/real é mais acionável que só a data.** Assumimos que ver
  "precisa de €200/mês, você paga €130" muda comportamento mais que ver só
  "dez/26". Se o número de ritmo for ignorado, simplificar para só data + status.

## Open questions (resolvidas)

- Meta vencida com dívida aberta: **mantém a data, marca `overdue` e oferece CTA de
  repactuação** ("definir novo prazo"), reusando o edit dialog. Não força modal.
- Ritmo real: **média sobre meses decorridos desde o 1º pagamento**, com piso de 2
  meses de histórico pra exibir a comparação (abaixo disso, só ritmo necessário).
