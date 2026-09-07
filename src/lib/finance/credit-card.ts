/**
 * Ciclo de fatura do cartão de crédito. Puro: datas entram e saem como ISO
 * (YYYY-MM-DD), sem Date exposta na API — evita drama de timezone.
 *
 * Regra: o dia do fechamento é EXCLUSIVO. Compra no dia d do mês M com
 * d < closingDay cai no ciclo que fecha em M; d >= closingDay já cai na
 * fatura seguinte (fecha em M+1). O vencimento fica no mês do fechamento
 * quando dueDay >= closingDay, senão no mês seguinte. Dias 29-31 são
 * clampados ao último dia do mês (fecha dia 31 → 28/fev).
 */

export type CardCycle = {
  /** Primeiro dia do ciclo — o próprio dia do fechamento anterior. */
  opensOn: string;
  closesOn: string;
  dueOn: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Dia clampado ao último do mês; monthIndex0 pode transbordar de 0..11. */
function clampedIsoDate(year: number, monthIndex0: number, day: number): string {
  const y = year + Math.floor(monthIndex0 / 12);
  const m = ((monthIndex0 % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${pad2(m + 1)}-${pad2(Math.min(day, lastDay))}`;
}

/** Ciclo (abertura, fechamento e vencimento) em que uma compra cai. */
export function cycleForPurchase(
  purchasedOn: string,
  closingDay: number,
  dueDay: number,
): CardCycle {
  const [y, m, d] = purchasedOn.split('-').map(Number) as [number, number, number];
  const monthIndex0 = m - 1;

  // Compara contra o fechamento CLAMPADO do mês da compra: em fevereiro, um
  // cartão que fecha dia 31 fecha no dia 28 — compra do dia 28 já cai em março.
  const closingThisMonth = clampedIsoDate(y, monthIndex0, closingDay);
  const closingDayThisMonth = Number(closingThisMonth.slice(8, 10));
  const closeMonthIndex0 = monthIndex0 + (d < closingDayThisMonth ? 0 : 1);

  const closesOn = clampedIsoDate(y, closeMonthIndex0, closingDay);
  const opensOn = clampedIsoDate(y, closeMonthIndex0 - 1, closingDay);
  const dueOn = clampedIsoDate(y, closeMonthIndex0 + (dueDay >= closingDay ? 0 : 1), dueDay);

  return { opensOn, closesOn, dueOn };
}

/** Ciclo em andamento numa data: o ciclo em que uma compra dessa data cairia. */
export function openCycleOn(todayIso: string, closingDay: number, dueDay: number): CardCycle {
  return cycleForPurchase(todayIso, closingDay, dueDay);
}

/** Reconstrói o ciclo a partir do vencimento (inverso de cycleForPurchase). */
export function cycleForDueDate(dueOn: string, closingDay: number, dueDay: number): CardCycle {
  const [y, m] = dueOn.split('-').map(Number) as [number, number];
  const closeMonthIndex0 = m - 1 - (dueDay >= closingDay ? 0 : 1);
  const closesOn = clampedIsoDate(y, closeMonthIndex0, closingDay);
  const opensOn = clampedIsoDate(y, closeMonthIndex0 - 1, closingDay);
  return { opensOn, closesOn, dueOn };
}

/** Dia do mês com o maior prazo até o vencimento: o próprio dia do fechamento. */
export function bestPurchaseDay(closingDay: number): number {
  return closingDay;
}
