# Reserva financeira — gauge de saúde e recomendação de alocação

## Problema

owner guarda dinheiro em caixinhas, mas não tem nenhum sinal de **se a reserva é suficiente**. Hoje, pra saber se está protegido contra imprevisto, precisa lembrar quanto gasta por mês, lembrar quanto tem guardado, e dividir um pelo outro de cabeça. Três efeitos:

1. **"Quanto é suficiente?" fica sem resposta**: 5 mil guardados é muito ou pouco? Depende do custo de vida, que ninguém calcula na hora.
2. **A sobra do mês não tem destino claro além de dívida**: a sugestão de dívida existe (≤ 60% da sobra), mas os 40% restantes evaporam em consumo sem nudge pra reserva.
3. **Sem reserva, pagar dívida agressivo é furada**: quem não tem piso de emergência e joga tudo na dívida fica exposto — qualquer susto vira dívida nova. Não há sinal que diga "monte o piso primeiro".

## Usuário afetado

- **owner no dashboard e na aba Reserva** (peso alto, recorrente): vê a faixa de saúde da reserva em meses cobertos, e vê a sobra do mês já fatiada entre dívida / reserva / livre conforme a faixa.
- **owner/co-membro sem custo essencial calculável** (sem recorrentes nem categoria essencial marcada): vê a aba pedindo pra marcar categorias essenciais, sem gauge fantasma.

Não é pra: planejamento de investimento (o app não rastreia investimento), metas de poupança nomeadas (isso já são as caixinhas comuns), projeção de aposentadoria.

## Métrica de sucesso

**A reserva designada sobe de faixa pelo menos uma vez nas primeiras 8 semanas pós-deploy**, OU **≥ 1 alocação na caixinha de reserva é feita a partir da recomendação do dashboard**. Medido por: snapshot da faixa ao longo do tempo + contagem de movimentações pra caixinha `is_reserve = true` originadas do card de recomendação.

Se a faixa nunca sobe e ninguém aloca pela recomendação em 8 semanas, ou o cálculo de custo essencial está errado (faixa parece injusta) ou a recomendação não convence.

Proxy direto: o gauge mostra a faixa correta dado `reserva_alocada` e `custo_mensal_essencial` conhecidos (verificável por teste, não por uso).

## Escopo

### Dentro

**Custo mensal essencial (função pura em `src/lib/finance/reserva.ts`)**:

```
custo_mensal_essencial =
    Σ recurring_rules de despesa ativas (normalizadas a mês: monthly = amount, yearly = amount ÷ 12)
  + mediana dos 3 últimos meses COMPLETOS do gasto variável-essencial
```

- **variável-essencial** = transações `direction = 'expense'` em categorias com `is_essential = true`, **excluindo** as que têm `source_recurring_rule_id`, `source_installment_plan_id` ou `source_debt_id` preenchido (senão conta duplo com os recorrentes / parcela / dívida).
- **mês completo** = exclui o mês corrente (parcial, subestimaria). Janela = 3 meses anteriores ao corrente.
- **mediana** (não média): com 3 pontos, um mês atípico vira extremo e é descartado.
- **<3 meses completos de histórico**: usa só a parte de recorrentes e marca `variableCalibrating = true` pra UI avisar que a fração variável está calibrando.

**Faixas de saúde (absolutas, ancoradas no consenso 3/6/12 — sem meta configurável)**:

```
meses_cobertos = reserva_alocada / custo_mensal_essencial
```

| Faixa | meses_cobertos | Copy |
|---|---|---|
| `sem_reserva` | 0 | "Qualquer imprevisto vira dívida" |
| `em_formacao` | 0 < m < 3 | "Cobre sustos pequenos, abaixo do piso" |
| `minima` | 3 ≤ m < 6 | "Piso de segurança atingido" |
| `saudavel` | 6 ≤ m < 12 | "Padrão recomendado" |
| `reforcada` | m ≥ 12 | "Cobre renda variável / cenário conservador" |

**Reserva = caixinha designada**:
- reusa a tabela `envelopes`. Migration adiciona `is_reserve boolean not null default false`.
- exatamente uma caixinha por household pode ter `is_reserve = true` (constraint parcial única).
- `reserva_alocada` = `current_cents` da caixinha de reserva (na currency dela; convertida pra primaryCurrency se diferente).

**Motor de recomendação (a faixa modula dois parâmetros)**:

| Faixa | Teto dívida | Fator reserva (do restante pós-dívida) | Modo |
|---|---|---|---|
| `sem_reserva` | 30% | 70% | guardar |
| `em_formacao` | 45% | 55% | guardar |
| `minima` | 60% | 40% | guardar |
| `saudavel` | 60% | 20% | guardar (copy sugere investir o resto) |
| `reforcada` | 60% | 0% | investir (copy only) |

- `60%` continua sendo o **teto** da dívida — só desce abaixo dele quando a reserva é crítica (`sem_reserva`, `em_formacao`). Isso preserva a regra "pagar dívida até 60%".
- `recomendado_reserva = round((sobra − sugestao_divida) × fator_da_faixa)`.
- `reforcada`: fator 0; card de reserva não propõe alocação, copy diz "excedente pode ir pra investimento de longo prazo".
- helpers puros: `debtCapForBand(band)`, `reserveFactorForBand(band)`, `computeReservaSuggestion({ sobraCents, suggestedDebtCents, reservaAllocatedCents, monthlyEssentialCents })`.

**Aba nova "Reserva"** (sob "Mais"):
- gauge editorial: `meses_cobertos` como número herói (`.num--hero`), escala horizontal com marcas em 3 / 6 / 12, status em sentence case.
- mostra `custo_mensal_essencial` e `reserva_alocada` que produziram o número.
- aviso quando `variableCalibrating` ("parte variável calibrando — precisa de 3 meses de histórico").
- estado vazio quando `custo_mensal_essencial = 0`: pede pra marcar categorias essenciais.

**Toggle `is_essential` em categorias**:
- migration adiciona `categories.is_essential boolean not null default false`.
- toggle na tela de categorias existente.

**Integração com o card de sugestão existente**:
- `computeDebtSuggestion` (`src/lib/finance/debt-suggestion.ts`): `MAX_RATIO` fixo `0.6` vira `input.maxRatio` com default `0.6` (retrocompatível com `debt-suggestion.test.ts`).
- ordem de cálculo inverte: resolver a faixa da reserva **antes** da sugestão de dívida (faixa independe da sobra, só de `reserva_alocada / custo_essencial`).
- `insights-block.tsx` passa a buscar a alocação da caixinha de reserva + o custo essencial, deriva a faixa, passa `maxRatio = debtCapForBand(band)` pro `computeDebtSuggestion`, e renderiza um **card único "destino da sobra"** que substitui o `DebtSuggestionCard` isolado: mostra dívida (≤ teto da faixa), reserva (fator da faixa) e livre, cada um com seu valor e ação. Em `reforcada`, a linha de reserva vira copy de "investir".

### Fora (explicitamente)

- **Entidade de investimento**: "investir" nas faixas altas é só copy. App não rastreia investimento. Outra feature.
- **Meta de meses configurável**: descartado explicitamente. As faixas absolutas são a história inteira.
- **Seletor de perfil de renda (CLT 6 / autônomo 12)**: sem meta, não há multiplicador pra pré-preencher. Fora.
- **Alocação automática da sobra na reserva**: a recomendação é nudge, não débito automático. owner aloca manualmente via caixinha.
- **Números do motor editáveis via UI**: 30/45/60 e 70/55/40/20/0 ficam como constantes no `reserva.ts`. Afináveis no código.
- **Mais de uma caixinha de reserva**: uma só por household.
- **Considerar parcelas/dívida no custo essencial**: decidido que essencial = recorrentes + categorias essenciais. Parcela e dívida ficam fora da baseline.
- **Reserva por moeda separada (EUR e BRL independentes)**: custo essencial e reserva são consolidados na `preferred_display_currency` do owner via `fxRateMap`, como o resto do app.

## Abordagem proposta

Toda a aritmética em funções puras em `src/lib/finance/reserva.ts` (custo essencial, meses cobertos, faixa, caps, recomendação), testáveis sem Supabase. O cálculo de custo essencial recebe as linhas já carregadas (recorrentes ativas + transações variáveis-essenciais dos 3 meses), não acessa banco direto — quem busca é um data-loader fino em `src/lib/finance/`. Dashboard e aba Reserva são server components que chamam os loaders + helpers. `computeDebtSuggestion` ganha `maxRatio` como input; o resto do contrato não muda.

## Dependências

- **Tabela `envelopes`** (migration 0006) — reusada, ganha `is_reserve`.
- **`fxRateMap` / `convertCents`** (`src/lib/fx`) — já existe, pra consolidar moedas.
- **stats de sobra** (`calculateCrossCurrencyMonthStats` / dashboard-data) — fonte de `sobraPrevistaCents`, sem mudança de fórmula.
- **Tela de categorias** — ganha o toggle `is_essential`.
- Nada novo de dependência externa.

## Riscos

- **Custo essencial subestimado nos primeiros 3 meses** (só recorrentes, sem variável): prob. alta, impacto médio — a faixa parece melhor do que é (menos custo → mais meses cobertos). Mitigação: aviso `variableCalibrating` explícito na UI. Aceitar até ter histórico.
- **owner não marca nenhuma categoria como essencial**: prob. média, impacto alto (custo variável = 0, faixa inflada). Mitigação: estado vazio que pede pra marcar; documentar que recorrentes sozinhos já dão um piso.
- **Mediana de 3 ainda balança com dois meses atípicos seguidos**: prob. baixa, impacto baixo. Aceitar — recalibra no mês seguinte.
- **Teto de dívida cair pra 30% atrasa quitação de quem tem dívida cara e zero reserva**: prob. média, impacto médio — é o trade-off intencional (baby-step 1). Aceitar; é a tese da feature.
- **Conversão EUR↔BRL imprecisa no custo essencial e na reserva**: prob. alta em valores grandes, impacto baixo (centavos). Aceitar.
- **Caixinha de reserva apagada deixa household sem `is_reserve`**: prob. baixa, impacto baixo — gauge cai pra estado "designe uma caixinha de reserva". Aceitar.

## Hipóteses a validar

- **"Recorrentes + categorias essenciais aproximam bem o custo essencial"**: se a faixa parecer consistentemente errada (owner sente que tem mais/menos reserva do que o gauge diz), revisar o que entra na baseline.
- **"Fatores 70/55/40/20/0 incentivam sem sufocar"**: se owner sempre aloca menos que o recomendado em `sem_reserva`, o 70% está agressivo demais; recalibrar.
- **"Teto de dívida modulado pela faixa faz sentido pro owner"**: se ele estranhar a dívida sugerida cair quando a reserva está baixa, revisitar (ou explicar melhor na copy do card).

## Decisões resolvidas

- **Card no dashboard**: **card único "destino da sobra"** (dívida + reserva + livre), em vez de dois cards competindo. Substitui o `DebtSuggestionCard` isolado por um card que mostra os três destinos da sobra.
- **Moeda de consolidação**: respeitar **`preferred_display_currency`** do owner — custo essencial, reserva e meses cobertos são exibidos e consolidados nessa moeda via `fxRateMap`.
- **Constraint de reserva única**: **partial unique index** no banco (`unique (household_id) where is_reserve`).
- **Ticket mínimo de reserva**: **nenhum** — qualquer valor recomendado > 0 aparece.
- **Migração de dados de `is_essential`**: **não** — default `false`, owner marca manualmente.

## Plano de testes (TDD outside-in)

**Camada 1 — E2E (Playwright)**
- owner marca categorias essenciais → abre aba Reserva → vê faixa e meses cobertos coerentes com seed.
- owner sem categoria essencial → vê estado vazio pedindo pra marcar.
- household com <3 meses de histórico → vê aviso de calibração.
- dashboard com reserva `sem_reserva` + dívida → card mostra teto de dívida 30% e recomendação de reserva 70% do restante.

**Camada 2 — Integração (Vitest + Supabase local)**
- loader do custo essencial: soma recorrentes ativas + mediana variável, exclui transações ligadas a recorrente/parcela/dívida, respeita RLS por household.
- `is_reserve` único por household (constraint barra a segunda).
- ordem de cálculo no insights: faixa resolvida antes da dívida, `maxRatio` aplicado.

**Camada 3 — Unit (Vitest, `src/lib/finance/reserva.ts`)**
- `bandForMonths`: bordas exatas (0, 2.99, 3, 5.99, 6, 11.99, 12).
- `debtCapForBand` / `reserveFactorForBand`: tabela completa.
- `computeReservaSuggestion`: split correto em cada faixa, com dívida no teto e sem dívida; modo `investir` em `reforcada`.
- `monthlyEssential`: normalização monthly/yearly, mediana de 3, exclusão de vínculos, fallback <3 meses.
- `computeDebtSuggestion` com `maxRatio` variável: mantém comportamento com default 0.6; respeita cap menor.

**Camada 4 — Componente (Vitest + RTL)**
- gauge: dado `{ band, monthsCovered }`, renderiza status correto, marcas em 3/6/12, sem usar tokens `money-positive`/`money-negative`.

## Critérios de aceite

- [ ] `categories.is_essential` e `envelopes.is_reserve` criados via migration, com RLS preservada.
- [ ] Custo essencial = recorrentes normalizadas + mediana variável (3 meses completos, vínculos excluídos), com fallback e flag de calibração.
- [ ] `meses_cobertos` e faixa calculados corretamente nas 5 bordas.
- [ ] Gauge na aba Reserva: número herói, escala 3/6/12, status sentence case, sem cores de entrada/despesa, sem gamificação.
- [ ] Recomendação modula teto da dívida e fator da reserva por faixa; 60% permanece como teto máximo.
- [ ] `computeDebtSuggestion` aceita `maxRatio` sem quebrar testes existentes.
- [ ] Multi-moeda consolidada na `preferred_display_currency` via `fxRateMap`.
- [ ] Coverage: 95% em `src/lib/finance/reserva.ts`; E2E cobre os fluxos da Camada 1.
