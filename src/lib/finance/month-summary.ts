import { formatCentsToBRL } from '@/lib/money/format';
import type { Currency } from '@/components/finance/num';

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

const SYMBOL: Record<Currency, string> = { BRL: 'R$', EUR: '€' };

type CategoryLite = { name: string; totalCents: number };
type DebtLite = { id: string; title: string; currency: Currency; remainingCents: number };
type AccountLite = { name: string; currency: Currency; balanceCents: number };

export type FxRateMap = {
  EUR_BRL: number;
  BRL_EUR: number;
};

export type MonthSummaryInput = {
  now: Date;
  primaryCurrency: Currency;
  saldoPrevistoFimDoMesCents: number;
  sobraPrevistaCents: number;
  entradasMesCents: number;
  despesasPaidCents: number;
  despesasPendingCents: number;
  overdueCents: number;
  overdueCount: number;
  topCategories: CategoryLite[];
  openDebts: DebtLite[];
  closedDebts: DebtLite[];
  debtPaymentsByDebtId: Record<string, number>;
  accounts: AccountLite[];
  fxRateMap?: FxRateMap | null;
};

function money(cents: number, currency: Currency): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '−' : '';
  return `${sign}${SYMBOL[currency]} ${formatCentsToBRL(abs)}`;
}

function convertHalfEven(amountCents: number, rate: number): number {
  const raw = amountCents * rate;
  const floor = Math.floor(raw);
  const diff = raw - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

function totalInPrimary(
  accounts: AccountLite[],
  primary: 'EUR' | 'BRL',
  fxRateMap?: FxRateMap | null,
): { cents: number; fxIncomplete: boolean } {
  let total = 0;
  let fxIncomplete = false;
  for (const a of accounts) {
    if (a.currency === primary) {
      total += a.balanceCents;
    } else if (fxRateMap) {
      const rate = primary === 'EUR' ? fxRateMap.BRL_EUR : fxRateMap.EUR_BRL;
      total += convertHalfEven(a.balanceCents, rate);
    } else {
      fxIncomplete = true;
    }
  }
  return { cents: total, fxIncomplete };
}

export function buildMonthSummaryText(input: MonthSummaryInput): string {
  const monthName = MONTHS_PT[input.now.getMonth()];
  const year = input.now.getFullYear();
  const c = input.primaryCurrency;

  const blocks: string[][] = [];

  blocks.push([`Resumo de ${monthName} · ${year}`]);

  blocks.push([
    `Saldo previsto fim do mês: ${money(input.saldoPrevistoFimDoMesCents, c)}`,
  ]);

  const despesasTotalCents = input.despesasPaidCents + input.despesasPendingCents;
  const movBlock = [
    `Entradas: ${money(input.entradasMesCents, c)}`,
    `Despesas: ${money(despesasTotalCents, c)} (já pago: ${money(input.despesasPaidCents, c)}, pendente: ${money(input.despesasPendingCents, c)})`,
  ];
  if (input.overdueCount > 0) {
    const plural = input.overdueCount === 1 ? 'transação' : 'transações';
    movBlock.push(`Em atraso: ${money(input.overdueCents, c)} (${input.overdueCount} ${plural})`);
  }
  blocks.push(movBlock);

  if (input.topCategories.length > 0) {
    blocks.push([
      'Top categorias:',
      ...input.topCategories.map((cat) => `- ${cat.name}: ${money(cat.totalCents, c)}`),
    ]);
  }

  if (input.openDebts.length > 0 || input.closedDebts.length > 0) {
    const paidSuffix = (d: DebtLite) => {
      const paidThis = input.debtPaymentsByDebtId[d.id] ?? 0;
      return paidThis > 0 ? ` (pago este mês: ${money(paidThis, d.currency)})` : '';
    };
    const openLines = input.openDebts.map(
      (d) => `- ${d.title}: ${money(d.remainingCents, d.currency)} restante${paidSuffix(d)}`,
    );
    const closedLines = input.closedDebts.map((d) => `- ${d.title}: quitada${paidSuffix(d)}`);
    blocks.push(['Dívidas:', ...openLines, ...closedLines]);
  }

  if (input.accounts.length > 0) {
    const { cents, fxIncomplete } = totalInPrimary(input.accounts, c, input.fxRateMap);
    const block = [`Saldo total das contas: ${money(cents, c)}`];
    if (fxIncomplete) {
      block.push('(fx indisponível — contas em outra moeda não foram somadas)');
    }
    blocks.push(block);
  }

  return blocks.map((block) => block.join('\n')).join('\n\n');
}
