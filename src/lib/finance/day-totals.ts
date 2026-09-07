/**
 * Totais do grupo de um dia em /transacoes. Transferências/conversões entre
 * contas ficam de fora — são neutras no fluxo, como nos totais do topo.
 */

export type DayTotalsRow = {
  direction: 'expense' | 'income';
  amount_cents: number;
  currency: 'BRL' | 'EUR';
  transfer?: unknown;
};

export type DayTotals = {
  currency: 'BRL' | 'EUR';
  expenseCents: number;
  incomeCents: number;
};

export function sumDayTotals(rows: DayTotalsRow[]): DayTotals[] {
  const byCurrency = new Map<'BRL' | 'EUR', { expense: number; income: number }>();
  for (const row of rows) {
    if (row.transfer) continue;
    const bucket = byCurrency.get(row.currency) ?? { expense: 0, income: 0 };
    if (row.direction === 'expense') bucket.expense += row.amount_cents;
    else bucket.income += row.amount_cents;
    byCurrency.set(row.currency, bucket);
  }
  return (['EUR', 'BRL'] as const)
    .filter((currency) => byCurrency.has(currency))
    .map((currency) => ({
      currency,
      expenseCents: byCurrency.get(currency)!.expense,
      incomeCents: byCurrency.get(currency)!.income,
    }));
}
