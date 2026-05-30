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

// Teto da sugestão de dívida por faixa: 60% é o máximo; só desce abaixo dele
// quando a reserva é crítica, pra liberar sobra ao piso de emergência primeiro.
const DEBT_CAP_BY_BAND: Record<ReservaBand, number> = {
  sem_reserva: 0.3,
  em_formacao: 0.45,
  minima: 0.6,
  saudavel: 0.6,
  reforcada: 0.6,
};

export function debtCapForBand(band: ReservaBand): number {
  return DEBT_CAP_BY_BAND[band];
}

// Fração do restante pós-dívida sugerida pra reserva. Guarda mais quanto menos
// reserva existe; zera em reforcada (excedente vai pra investimento).
const RESERVE_FACTOR_BY_BAND: Record<ReservaBand, number> = {
  sem_reserva: 0.7,
  em_formacao: 0.55,
  minima: 0.4,
  saudavel: 0.2,
  reforcada: 0,
};

export function reserveFactorForBand(band: ReservaBand): number {
  return RESERVE_FACTOR_BY_BAND[band];
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

export type ReservaSuggestionInput = {
  sobraCents: number;
  /** Já capado por debtCapForBand a montante (computeDebtSuggestion). */
  suggestedDebtCents: number;
  reservaAllocatedCents: number;
  monthlyEssentialCents: number;
};

export type ReservaSuggestion = {
  band: ReservaBand;
  monthsCovered: number;
  toReserveCents: number;
  toFreeCents: number;
  mode: 'guardar' | 'investir';
};

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

export function computeReservaSuggestion(input: ReservaSuggestionInput): ReservaSuggestion {
  const covered = monthsCovered(input.reservaAllocatedCents, input.monthlyEssentialCents);
  const band = bandForMonths(covered);
  const remainder = Math.max(0, input.sobraCents - input.suggestedDebtCents);
  const toReserveCents = Math.round(remainder * reserveFactorForBand(band));

  return {
    band,
    monthsCovered: covered,
    toReserveCents,
    toFreeCents: remainder - toReserveCents,
    mode: band === 'reforcada' ? 'investir' : 'guardar',
  };
}
