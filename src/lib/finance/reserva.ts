export type ReservaBand =
  | 'sem_reserva'
  | 'em_formacao'
  | 'minima'
  | 'saudavel'
  | 'reforcada';

// Faixas absolutas ancoradas no consenso de reserva de emergência (3 / 6 / 12
// meses de custo essencial). Decisões e racional em docs/prds/reserva-financeira.md.
export function bandForMonths(monthsCovered: number): ReservaBand {
  if (monthsCovered <= 0) return 'sem_reserva';
  if (monthsCovered < 3) return 'em_formacao';
  if (monthsCovered < 6) return 'minima';
  if (monthsCovered < 12) return 'saudavel';
  return 'reforcada';
}

export function monthsCovered(reservaCents: number, monthlyEssentialCents: number): number {
  if (monthlyEssentialCents <= 0) return 0;
  return reservaCents / monthlyEssentialCents;
}

export type RecurringExpenseRule = {
  amountCents: number;
  frequency: 'monthly' | 'yearly';
};

export function monthlyRecurringExpenseCents(rules: RecurringExpenseRule[]): number {
  return rules.reduce((sum, rule) => {
    const monthly =
      rule.frequency === 'yearly' ? Math.round(rule.amountCents / 12) : rule.amountCents;
    return sum + monthly;
  }, 0);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export type MonthlyEssentialInput = {
  recurringMonthlyCents: number;
  variableMonthlyTotals: number[];
  hasEnoughHistory: boolean;
};

export type MonthlyEssential = {
  cents: number;
  variableCalibrating: boolean;
};

// Com <3 meses completos a mediana variável é ruído: usa só recorrentes e
// sinaliza calibração pra UI avisar que a parte variável ainda não entrou.
export function monthlyEssential(input: MonthlyEssentialInput): MonthlyEssential {
  if (!input.hasEnoughHistory) {
    return { cents: input.recurringMonthlyCents, variableCalibrating: true };
  }
  return {
    cents: input.recurringMonthlyCents + median(input.variableMonthlyTotals),
    variableCalibrating: false,
  };
}

const BAND_LABEL: Record<ReservaBand, string> = {
  sem_reserva: 'Sem reserva',
  em_formacao: 'Em formação',
  minima: 'Mínima',
  saudavel: 'Saudável',
  reforcada: 'Reforçada',
};

const BAND_COPY: Record<ReservaBand, string> = {
  sem_reserva: 'Qualquer imprevisto vira dívida',
  em_formacao: 'Cobre sustos pequenos, abaixo do piso',
  minima: 'Piso de segurança atingido',
  saudavel: 'Padrão recomendado',
  reforcada: 'Cobre renda variável / cenário conservador',
};

export function bandLabel(band: ReservaBand): string {
  return BAND_LABEL[band];
}

export function bandCopy(band: ReservaBand): string {
  return BAND_COPY[band];
}
