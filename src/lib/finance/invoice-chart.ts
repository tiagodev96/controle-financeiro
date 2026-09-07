import { addMonths } from '@/lib/dates';

/**
 * Série mensal do gráfico de faturas do cartão: até `monthsBack` meses antes
 * do mês da fatura aberta e todos os meses com fatura à frente, eixo contíguo
 * (mês sem fatura vira barra zero). Estado é relativo ao mês aberto.
 */

export type InvoiceChartMonth = {
  monthIso: string;
  totalCents: number;
  state: 'past' | 'open' | 'future';
};

type InvoiceLike = { dueOn: string; totalCents: number };

export function buildInvoiceChartMonths(
  invoices: InvoiceLike[],
  { openMonthIso, monthsBack = 2 }: { openMonthIso: string; monthsBack?: number },
): InvoiceChartMonth[] {
  if (invoices.length === 0) return [];

  const totalsByMonth = new Map<string, number>();
  for (const invoice of invoices) {
    const month = invoice.dueOn.slice(0, 7);
    totalsByMonth.set(month, (totalsByMonth.get(month) ?? 0) + invoice.totalCents);
  }

  const invoiceMonths = Array.from(totalsByMonth.keys()).sort();
  const earliest = invoiceMonths[0]!;
  const latest = invoiceMonths[invoiceMonths.length - 1]!;

  // Começa no mais recente entre (aberto − monthsBack) e a fatura mais antiga,
  // mas nunca depois do mês aberto — ele é a âncora visual do "agora".
  const backLimit = addMonths(openMonthIso, -monthsBack);
  const start = (earliest > backLimit ? earliest : backLimit) < openMonthIso
    ? (earliest > backLimit ? earliest : backLimit)
    : openMonthIso;
  const end = latest > openMonthIso ? latest : openMonthIso;

  const months: InvoiceChartMonth[] = [];
  for (let month = start; month <= end; month = addMonths(month, 1)) {
    months.push({
      monthIso: month,
      totalCents: totalsByMonth.get(month) ?? 0,
      state: month === openMonthIso ? 'open' : month < openMonthIso ? 'past' : 'future',
    });
  }
  return months;
}
