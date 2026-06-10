# Recorrentes anuais

## Problema

Despesas que vencem uma vez por ano (seguro, IPTU, anuidade, domínio) não cabem no modelo atual de recorrentes — que só gera mensal. O casal ou lança na mão quando lembra (e geralmente não lembra), ou cria uma regra mensal errada. Resultado: susto no mês do vencimento e projeção de sobra furada.

## Usuário afetado

O casal nas despesas anuais conhecidas (3–6 por ano). Momento de dor: o mês do vencimento (cobrança esquecida) e a leitura da sobra projetada nos demais meses.

## Métrica de sucesso

Sem métrica direta. Proxy: despesa anual cadastrada uma vez aparece como pendente no mês certo do ano seguinte sem nenhuma ação manual; nos outros meses não aparece nem na projeção.

## Escopo

### Dentro

- `frequency: 'yearly'` no create/update de regras (o schema do banco já aceita; o core hardcoda `'monthly'` hoje).
- **Mês-aniversário derivado de `active_from`**: a regra anual gera só no mês de `active_from`, todo ano. Sem coluna nova, sem migration.
- Geração (`generateRecurringForMonthCore` + cron) pula regra anual fora do mês-aniversário — não conta como `failed` nem `skipped` de idempotência.
- Projeção e preview (`listUngeneratedRecurringForMonth`) idem — regra anual só vira ocorrência virtual no mês-aniversário.
- Indicador "não geradas em {mês}" (`listRecurringRulesForHousehold`) não conta anual fora do mês.
- UI: seletor mensal/anual no dialog de criar; label "anual · {mês}" no item da lista. Edição de frequency no dialog de editar.

### Fora (explicitamente)

- Coluna `month_of_year` dedicada — `active_from` resolve sem migration; revisitar só se o casal precisar mudar o mês sem recriar a regra.
- Frequências quinzenal/semanal/custom.
- Pro-rata ou provisão mensal (1/12) automática nas projeções dos outros meses — a reserva já normaliza anual ÷ 12 no custo essencial; duplicar isso na sobra mensal confundiria.
- Notificação antecipada do vencimento anual.

## Abordagem proposta

Helper puro `ruleAppliesToMonth(rule, monthIso)` compartilhado entre geração, preview e contagem: mensal sempre aplica; anual aplica se `mês(active_from) === mês(alvo)`. Zod ganha `frequency` com default `'monthly'` (compatível com todos os callers atuais).

## Dependências

- Nenhuma — schema (`frequency check in ('monthly','yearly')`, `active_from not null default current_date`) já está em prod.

## Riscos

- **Regra anual criada no mês errado** (usuário cria em junho uma despesa que vence em setembro): alta × médio → o dialog de criar regra anual expõe o seletor de mês (preenche `active_from` com o dia 1 do mês escolhido); default é o mês corrente.
- **Cron varre 3 meses** (gaps): o filtro por mês-aniversário é aplicado por mês-alvo dentro do loop, então um gap que inclui o mês-aniversário ainda gera. Sem mitigação extra necessária.
- **Regras anuais antigas com active_from herdado do default**: N/A — não existem regras anuais ainda (UI nunca permitiu criar).

## Hipóteses a validar

N/A: comportamento padrão de qualquer app de finanças.

## Open questions

Nenhuma.
