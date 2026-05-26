import { convertCents } from '@/lib/fx';
import type { Currency } from '@/components/finance/num';

const MIN_TICKET_EUR_CENTS = 5000; // € 50
const MAX_RATIO = 0.6;

export type SuggestionDebt = {
  id: string;
  title: string;
  currency: Currency;
  priority: 1 | 2 | 3;
  remainingCents: number;
};

export type SuggestionFxMap = {
  EUR_BRL: number;
  BRL_EUR: number;
};

export type DebtSuggestion = {
  debt: SuggestionDebt;
  suggestedCents: number;
  percOfDebt: number;
};

export type ComputeDebtSuggestionInput = {
  sobraEurCents: number;
  openDebts: SuggestionDebt[];
  fxRateMap: SuggestionFxMap | null;
};

/**
 * Calcula a sugestão de pagamento de dívida no dashboard:
 *   - sem dívidas open OU sobra abaixo do ticket mínimo → null
 *   - ordena dívidas por priority asc, remaining desc
 *   - escolhe a primeira pra qual maxAplicavel (60% da sobra) cobre ≥ € 50
 *   - dívidas BRL precisam de fxRateMap; sem ele, são ignoradas
 */
export function computeDebtSuggestion(input: ComputeDebtSuggestionInput): DebtSuggestion | null {
  if (input.sobraEurCents < MIN_TICKET_EUR_CENTS) return null;
  if (input.openDebts.length === 0) return null;

  const maxAplicavelEur = Math.floor(input.sobraEurCents * MAX_RATIO);
  if (maxAplicavelEur < MIN_TICKET_EUR_CENTS) return null;

  const sorted = [...input.openDebts].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.remainingCents - a.remainingCents;
  });

  for (const debt of sorted) {
    if (debt.remainingCents <= 0) continue;
    if (debt.currency === 'BRL' && !input.fxRateMap) continue;

    const maxInDebtCurrency =
      debt.currency === 'EUR'
        ? maxAplicavelEur
        : convertCents(maxAplicavelEur, input.fxRateMap!.EUR_BRL);

    const suggestedCents = Math.min(maxInDebtCurrency, debt.remainingCents);
    const minInDebtCurrency =
      debt.currency === 'EUR'
        ? MIN_TICKET_EUR_CENTS
        : convertCents(MIN_TICKET_EUR_CENTS, input.fxRateMap!.EUR_BRL);

    if (suggestedCents < minInDebtCurrency) continue;

    return {
      debt,
      suggestedCents,
      percOfDebt: suggestedCents / debt.remainingCents,
    };
  }

  return null;
}
