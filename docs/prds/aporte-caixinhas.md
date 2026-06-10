# Aporte mensal em caixinhas

## Problema

Caixinhas com meta (`target_cents`) hoje são estáticas: o casal define a meta, mas não tem plano de chegada — nem sabe se guardando o ritmo atual chega em 6 meses ou em 4 anos. Sem um valor de aporte combinado, a alocação mensal vira decisão repetida (e adiada) todo mês.

## Usuário afetado

O casal no ritual de início de mês (alocar a sobra), principalmente pras caixinhas de objetivo (viagem, troca de notebook). A reserva de emergência já tem recomendação própria na página `/reserva`.

## Métrica de sucesso

Sem métrica direta. Proxy: cada caixinha com meta responde na própria lista "guardando € X/mês, chega em {mês}" — zero cálculo manual. Revisão qualitativa após 2 meses.

## Escopo

### Dentro

- Coluna nova `envelopes.monthly_contribution_cents` (nullable, > 0) — **migration 0012, aplicar manualmente em prod**.
- Campo "Aporte mensal (opcional)" nos dialogs de criar e editar caixinha.
- Projeção na lista: "no ritmo, atinge a meta em {mês}" via lib pura `envelope-projection.ts` (`monthsToTarget` + `projectedTargetMonth`), só quando há meta + aporte e a meta ainda não foi atingida.
- Registro do aporte continua pelo fluxo existente de mover dinheiro pra caixinha (move dialog) — o valor do aporte vira o prefill sugerido.

### Fora (explicitamente)

- Aporte automático de verdade (criar transação/transferência no dia 1 via cron) — o dinheiro das caixinhas é virtual e a alocação é decisão consciente do casal; automatizar esconderia o ritual.
- Aporte pra reserva de emergência — a página `/reserva` já calcula recomendação por banda.
- Histórico de aportes por caixinha.
- Rebalanceamento entre caixinhas.

## Abordagem proposta

Coluna nullable no schema; Zod ganha `monthlyContributionCents` no create/update (mesma transform do `targetCents`); lib pura calcula meses restantes = teto((meta − atual) / aporte) e projeta o mês-alvo com `addMonths`. UI mostra a projeção no item e usa o aporte como prefill do move dialog.

## Dependências

- Migration manual em prod (tracking dessincronizado — sem `db push`).

## Riscos

- **Aporte definido e nunca executado** (projeção vira ficção): média × baixo → a projeção é recalculada do `current_cents` real; se o casal não aporta, o mês-alvo desliza sozinho e fica visível.
- **Meta atingida com aporte ainda configurado**: baixa × baixo → projeção some quando `current >= target`.

## Hipóteses a validar

N/A.

## Open questions

Nenhuma.
