import { MONTHS_PT_SHORT, toIsoDate } from '@/lib/dates';

export type DeadlineStatus = 'on-track' | 'tight' | 'overdue';

function yearMonth(iso: string): { y: number; m: number } {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) };
}

export function monthsUntil(deadlineIso: string, todayIso: string): number {
  const d = yearMonth(deadlineIso);
  const t = yearMonth(todayIso);
  return (d.y - t.y) * 12 + (d.m - t.m);
}

export function requiredMonthlyCents(remainingCents: number, monthsLeft: number): number {
  if (remainingCents <= 0) return 0;
  if (monthsLeft <= 0) return remainingCents;
  return Math.ceil(remainingCents / monthsLeft);
}

export function projectedQuitMonth(
  remainingCents: number,
  actualMonthlyCents: number,
  todayIso: string,
): string | null {
  if (remainingCents <= 0 || actualMonthlyCents <= 0) return null;

  const months = Math.ceil(remainingCents / actualMonthlyCents);
  const { y, m } = yearMonth(todayIso);
  const zeroBased = m - 1 + (months - 1);
  const finishY = y + Math.floor(zeroBased / 12);
  const finishM = (zeroBased % 12) + 1;
  return `${finishY}-${String(finishM).padStart(2, '0')}`;
}

export function deadlineStatus(args: {
  deadlineIso: string;
  todayIso: string;
  remainingCents: number;
  actualMonthlyCents: number | null;
}): DeadlineStatus {
  const months = monthsUntil(args.deadlineIso, args.todayIso);
  if (months < 0) return 'overdue';
  if (months <= 2) return 'tight';

  if (args.actualMonthlyCents && args.actualMonthlyCents > 0) {
    const projected = projectedQuitMonth(
      args.remainingCents,
      args.actualMonthlyCents,
      args.todayIso,
    );
    if (projected && projected > args.deadlineIso.slice(0, 7)) return 'tight';
  }

  return 'on-track';
}

export function monthToDeadlineIso(yearMonthStr: string): string {
  const y = Number(yearMonthStr.slice(0, 4));
  const m = Number(yearMonthStr.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0));
  return toIsoDate(lastDay);
}

function utcDay(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)) || 1,
  );
}

export function daysUntil(deadlineIso: string, todayIso: string): number {
  return Math.round((utcDay(deadlineIso) - utcDay(todayIso)) / 86_400_000);
}

export function formatDeadlineMonth(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return `${MONTHS_PT_SHORT[m - 1]}/${iso.slice(2, 4)}`;
}
