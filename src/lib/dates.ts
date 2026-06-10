/**
 * Utilitários de data do domínio: mês fiscal, ISO strings e parsing de
 * searchParams. Convenção do projeto: intervalos de mês são construídos de
 * componentes LOCAIS (toISOString deslocaria a borda do mês em fusos
 * positivos); `toIsoDate` mantém a semântica UTC usada pelos call sites
 * de "hoje".
 */

export const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

export const MONTHS_PT_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const;

type MoneyCurrency = 'EUR' | 'BRL';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Data ISO do dia LOCAL do usuário — pra prefill de inputs de data. */
export function toLocalIsoDate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function monthIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export type MonthRange = { start: string; end: string };

export function monthRange(d: Date): MonthRange {
  return monthRangeFromIso(monthIso(d));
}

export function monthRangeFromIso(ym: string): MonthRange {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`monthIso inválido: ${ym}`);
  const start = `${y}-${pad2(m)}-01`;
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad2(m + 1)}-01`;
  return { start, end };
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) throw new Error(`monthIso inválido: ${ym}`);
  const zeroBased = m - 1 + n;
  const targetY = y + Math.floor(zeroBased / 12);
  const targetM = ((zeroBased % 12) + 12) % 12;
  return `${targetY}-${pad2(targetM + 1)}`;
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export type MonthParamResult = {
  targetDate: Date;
  monthIso: string;
  isPast: boolean;
  isFuture: boolean;
};

/**
 * Interpreta o searchParam `mes` (YYYY-MM). Inválido ou ausente cai no mês
 * corrente. Pra mês != corrente, targetDate é o ÚLTIMO dia do mês alvo —
 * preserva a semântica de "fim do mês" usada pelas stats.
 */
export function parseMonthParam(raw: string | null | undefined, now: Date): MonthParamResult {
  const currentIso = monthIso(now);
  const current: MonthParamResult = {
    targetDate: now,
    monthIso: currentIso,
    isPast: false,
    isFuture: false,
  };

  const match = raw ? /^(\d{4})-(\d{2})$/.exec(raw) : null;
  if (!match) return current;

  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) return current;

  const targetIso = `${y}-${pad2(m)}`;
  if (targetIso === currentIso) return current;

  return {
    targetDate: new Date(y, m, 0),
    monthIso: targetIso,
    isPast: targetIso < currentIso,
    isFuture: targetIso > currentIso,
  };
}

export function parseMoedaParam(
  raw: string | null | undefined,
  fallback: MoneyCurrency,
): MoneyCurrency {
  if (raw === 'EUR' || raw === 'eur') return 'EUR';
  if (raw === 'BRL' || raw === 'brl') return 'BRL';
  return fallback;
}

export function monthEyebrow(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} · ${d.getFullYear()}`;
}
