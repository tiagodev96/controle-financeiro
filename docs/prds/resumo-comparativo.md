# Resumo comparativo mensal

## Problema

O `/resumo` mostra o mês isolado: o casal vê quanto entrou, quanto saiu e a sobra, mas não tem como saber se o mês foi melhor ou pior que o anterior sem trocar o month picker manualmente e decorar os números. A pergunta mais comum na conversa de fim de mês — "gastamos mais ou menos que no mês passado?" — exige trabalho manual hoje.

## Usuário afetado

O casal do household na revisão mensal das finanças (fim/início de mês, geralmente pelo celular antes de compartilhar o resumo no WhatsApp). Peso menor: consulta avulsa ao longo do mês pra checar tendência de uma categoria específica.

## Métrica de sucesso

Sem métrica direta (uso pessoal, sem telemetria). Proxy: a variação aparece no `/resumo` sem nenhuma navegação extra — o custo de responder "melhorou ou piorou?" cai de ~4 interações (trocar mês, decorar, voltar, comparar) pra zero. Revisão qualitativa pelo owner após 2 meses de uso.

## Escopo

### Dentro

- Lib pura `src/lib/finance/month-comparison.ts` com `compareMonths(current, previous)` produzindo deltas (cents e percentual) de: entradas, despesas (pagas + pendentes) e sobra do fluxo do mês.
- Comparativo de top categorias tratando categoria presente em só um dos meses (nova → delta vs 0; sumiu → não listar).
- `loadResumoData` ganha o fetch do mês anterior (`previousStats`) no mesmo `Promise.all`, usando `addMonths` de `src/lib/dates.ts`.
- Chips de delta na página `/resumo` ao lado de Entradas, Despesas e Sobra: seta/sinal + percentual, verde (`--money-positive`) só quando a direção é boa (entrada subiu, despesa caiu), clay quando ruim. Sem delta quando o mês anterior não tem dados.
- Só pra mês corrente e meses passados. Mês futuro (projeção) não compara.

### Fora (explicitamente)

- Deltas na imagem OG / texto do WhatsApp — v2, depois de validar o layout na página.
- Comparação contra média de N meses ou mesmo mês do ano anterior — só mês imediatamente anterior.
- Gráfico de evolução (feature D do roadmap, separada).
- Comparativo de dívidas e contas (saldo total) — só fluxo do mês.

## Abordagem proposta

`loadResumoData` chama `calculateCrossCurrencyMonthStats` uma segunda vez com `targetDate = mês anterior` (mesma currency, mesmo fxRateMap) quando `!isFuture`. A página passa os dois stats pra `compareMonths` (pura, testável) e renderiza chips. Nenhuma mudança de schema.

## Dependências

- R1 (`addMonths` em `src/lib/dates.ts`) — entregue.
- R4 (`loadResumoData`) — entregue.

## Riscos

- **Percentual enganoso com base pequena** (mês anterior com € 5 de despesa → "+900%"): média probabilidade × baixo impacto → quando o valor base for < € 1,00 (100 cents), mostrar só o delta absoluto, sem percentual.
- **Custo extra de query por render do resumo** (uma chamada a mais de stats): baixa × baixo → aceito; mesma janela de Promise.all.
- **Cor verde/vermelha invertida pra despesa** (despesa menor = bom): certeza se não tratado → a lib retorna `direction: 'good' | 'bad' | 'neutral'` já semanticamente resolvida; a UI nunca decide cor sozinha.

## Hipóteses a validar

N/A: incremental sobre comportamento já validado (o casal já usa o resumo mensalmente).

## Open questions

Nenhuma — decisões de UI (chips, posição) seguem o design system existente (`.num`, tokens `--money-positive`/`--money-negative`).
