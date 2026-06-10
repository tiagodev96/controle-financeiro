import { addMonths } from '@/lib/dates';

/**
 * Meses de aporte até atingir a meta no ritmo configurado. Null quando não
 * há projeção possível (sem meta, sem aporte) ou a meta já foi atingida (0
 * meses não é projeção — é estado).
 */
export function monthsToTarget(
  currentCents: number,
  targetCents: number | null,
  monthlyContributionCents: number | null,
): number | null {
  if (!targetCents || targetCents <= 0) return null;
  if (!monthlyContributionCents || monthlyContributionCents <= 0) return null;
  const remaining = targetCents - currentCents;
  if (remaining <= 0) return null;
  return Math.ceil(remaining / monthlyContributionCents);
}

/** Mês (YYYY-MM) em que a meta é atingida partindo de `fromYm`, contando o próprio aporte de `fromYm`. */
export function projectedTargetMonth(fromYm: string, months: number): string {
  return addMonths(fromYm, months - 1);
}
