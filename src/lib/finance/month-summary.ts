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

function totalConvertedLine(accounts: AccountLite[], fxRateMap?: FxRateMap | null): string | null {
  if (!fxRateMap) return null;
  const hasEUR = accounts.some((a) => a.currency === 'EUR');
  const hasBRL = accounts.some((a) => a.currency === 'BRL');
  if (!hasEUR || !hasBRL) return null;

  let eurTotal = 0;
  let brlTotal = 0;
  for (const a of accounts) {
    if (a.currency === 'EUR') {
      eurTotal += a.balanceCents;
      brlTotal += convertHalfEven(a.balanceCents, fxRateMap.EUR_BRL);
    } else {
      brlTotal += a.balanceCents;
      eurTotal += convertHalfEven(a.balanceCents, fxRateMap.BRL_EUR);
    }
  }
  return `- Total convertido: ${money(eurTotal, 'EUR')} (${money(brlTotal, 'BRL')})`;
}

export function buildMonthSummaryText(input: MonthSummaryInput): string {
  const monthName = MONTHS_PT[input.now.getMonth()];
  const year = input.now.getFullYear();
  const c = input.primaryCurrency;

  const blocks: string[][] = [];

  blocks.push([`Resumo de ${monthName} · ${year}`]);

  blocks.push([
    `Saldo previsto fim do mês: ${money(input.saldoPrevistoFimDoMesCents, c)}`,
    `Sobra prevista: ${money(input.sobraPrevistaCents, c)}`,
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

  if (input.openDebts.length > 0) {
    const debtLines = input.openDebts.map((d) => {
      const paidThis = input.debtPaymentsByDebtId[d.id] ?? 0;
      const base = `- ${d.title}: ${money(d.remainingCents, d.currency)} restante`;
      return paidThis > 0
        ? `${base} (pago este mês: ${money(paidThis, d.currency)})`
        : base;
    });
    blocks.push(['Dívidas abertas:', ...debtLines]);
  }

  if (input.accounts.length > 0) {
    const totalLine = totalConvertedLine(input.accounts, input.fxRateMap);
    const accountLines = input.accounts.map(
      (a) => `- ${a.name}: ${money(a.balanceCents, a.currency)}`,
    );
    blocks.push([
      'Contas:',
      ...(totalLine ? [totalLine, ...accountLines] : accountLines),
    ]);
  }

  return blocks.map((block) => block.join('\n')).join('\n\n');
}
