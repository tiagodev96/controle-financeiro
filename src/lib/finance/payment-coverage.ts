import { convertCents } from '@/lib/fx';
import type { Currency } from '@/lib/fx';

export type CoverageAccount = {
  id: string;
  currency: Currency;
  balanceCents: number;
  sortOrder: number;
};

export type CoverageTransfer = {
  fromAccountId: string;
  toAccountId: string;
  fromAmountCents: number;
  toAmountCents: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number | null;
};

type CoverageRateMap = { EUR_BRL: number; BRL_EUR: number };

export type PlanPaymentCoverageParams = {
  expenseAccountId: string;
  amountCents: number;
  accounts: CoverageAccount[];
  rateMap: CoverageRateMap | null;
};

function rateBetween(
  rateMap: CoverageRateMap,
  from: Currency,
  to: Currency,
): number {
  if (from === to) return 1;
  return from === 'EUR' ? rateMap.EUR_BRL : rateMap.BRL_EUR;
}

/**
 * Dado o pagamento de uma despesa numa conta, devolve as transferências que
 * cobrem o déficit (valor − saldo da conta) puxando de outras contas: mesma
 * moeda primeiro, depois conversão pelo câmbio. Cobertura parcial — se as
 * origens não somarem o déficit, o restante fica descoberto (a conta da
 * despesa termina negativa). Função pura: quem persiste é o caller.
 */
export function planPaymentCoverage({
  expenseAccountId,
  amountCents,
  accounts,
  rateMap,
}: PlanPaymentCoverageParams): CoverageTransfer[] {
  const expense = accounts.find((a) => a.id === expenseAccountId);
  if (!expense) return [];

  let deficit = amountCents - expense.balanceCents;
  if (deficit <= 0) return [];

  const sources = accounts
    .filter((a) => a.id !== expenseAccountId && a.balanceCents > 0)
    .sort((a, b) => {
      const aSame = a.currency === expense.currency ? 0 : 1;
      const bSame = b.currency === expense.currency ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return a.sortOrder - b.sortOrder;
    });

  const transfers: CoverageTransfer[] = [];

  for (const source of sources) {
    if (deficit <= 0) break;

    if (source.currency === expense.currency) {
      const cover = Math.min(deficit, source.balanceCents);
      transfers.push({
        fromAccountId: source.id,
        toAccountId: expenseAccountId,
        fromAmountCents: cover,
        toAmountCents: cover,
        fromCurrency: source.currency,
        toCurrency: expense.currency,
        rate: null,
      });
      deficit -= cover;
      continue;
    }

    if (!rateMap) continue;

    const sourceToExpense = rateBetween(rateMap, source.currency, expense.currency);
    const expenseToSource = rateBetween(rateMap, expense.currency, source.currency);

    const availableInExpense = convertCents(source.balanceCents, sourceToExpense);
    const cover = Math.min(deficit, availableInExpense);
    if (cover <= 0) continue;

    const fromAmount = Math.min(
      convertCents(cover, expenseToSource),
      source.balanceCents,
    );

    transfers.push({
      fromAccountId: source.id,
      toAccountId: expenseAccountId,
      fromAmountCents: fromAmount,
      toAmountCents: cover,
      fromCurrency: source.currency,
      toCurrency: expense.currency,
      rate: sourceToExpense,
    });
    deficit -= cover;
  }

  return transfers;
}
