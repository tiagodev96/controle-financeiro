import { describe, it, expect } from 'vitest';
import {
  monthsUntil,
  requiredMonthlyCents,
  projectedQuitMonth,
  deadlineStatus,
  monthToDeadlineIso,
  daysUntil,
  formatDeadlineMonth,
} from './debt-deadline';

describe('monthsUntil', () => {
  it('U-DL1 — meses inteiros entre o mês de hoje e o mês da meta', () => {
    expect(monthsUntil('2026-12-31', '2026-05-30')).toBe(7);
  });

  it('U-DL2 — meta no mês corrente retorna 0 (ignora o dia)', () => {
    expect(monthsUntil('2026-05-31', '2026-05-01')).toBe(0);
    expect(monthsUntil('2026-05-31', '2026-05-30')).toBe(0);
  });

  it('U-DL3 — meta no passado retorna negativo', () => {
    expect(monthsUntil('2026-03-31', '2026-05-30')).toBe(-2);
  });

  it('U-DL4 — atravessa a virada de ano', () => {
    expect(monthsUntil('2027-02-28', '2026-11-15')).toBe(3);
  });
});

describe('requiredMonthlyCents', () => {
  it('U-DL5 — restante dividido pelos meses, arredondado pra cima', () => {
    expect(requiredMonthlyCents(120_000, 6)).toBe(20_000);
    expect(requiredMonthlyCents(100_000, 3)).toBe(33_334);
  });

  it('U-DL6 — sem meses restantes (≤0) exige o restante inteiro', () => {
    expect(requiredMonthlyCents(50_000, 0)).toBe(50_000);
    expect(requiredMonthlyCents(50_000, -3)).toBe(50_000);
  });

  it('U-DL7 — restante zero não exige nada', () => {
    expect(requiredMonthlyCents(0, 6)).toBe(0);
  });
});

describe('projectedQuitMonth', () => {
  it('U-DL8 — projeta o mês de quitação no ritmo real (este mês é o 1º pagamento)', () => {
    expect(projectedQuitMonth(600_00, 200_00, '2026-05-30')).toBe('2026-07');
  });

  it('U-DL9 — ritmo que não fecha em conta exata arredonda pra cima', () => {
    expect(projectedQuitMonth(600_00, 250_00, '2026-05-30')).toBe('2026-07');
  });

  it('U-DL10 — ritmo zero ou negativo não projeta', () => {
    expect(projectedQuitMonth(600_00, 0, '2026-05-30')).toBeNull();
    expect(projectedQuitMonth(600_00, -10, '2026-05-30')).toBeNull();
  });

  it('U-DL11 — restante zero não projeta', () => {
    expect(projectedQuitMonth(0, 200_00, '2026-05-30')).toBeNull();
  });
});

describe('deadlineStatus', () => {
  const base = { remainingCents: 100_000, actualMonthlyCents: null };

  it('U-DL12 — meta passada com dívida aberta é overdue', () => {
    expect(
      deadlineStatus({ ...base, deadlineIso: '2026-03-31', todayIso: '2026-05-30' }),
    ).toBe('overdue');
  });

  it('U-DL13 — faltando ≤2 meses é tight', () => {
    expect(
      deadlineStatus({ ...base, deadlineIso: '2026-07-31', todayIso: '2026-05-30' }),
    ).toBe('tight');
  });

  it('U-DL14 — prazo folgado sem ritmo real é on-track', () => {
    expect(
      deadlineStatus({ ...base, deadlineIso: '2026-12-31', todayIso: '2026-05-30' }),
    ).toBe('on-track');
  });

  it('U-DL15 — prazo folgado mas projeção no ritmo real passa da meta é tight', () => {
    expect(
      deadlineStatus({
        deadlineIso: '2026-12-31',
        todayIso: '2026-05-30',
        remainingCents: 600_00,
        actualMonthlyCents: 50_00,
      }),
    ).toBe('tight');
  });

  it('U-DL16 — prazo folgado e ritmo real fecha antes da meta é on-track', () => {
    expect(
      deadlineStatus({
        deadlineIso: '2026-12-31',
        todayIso: '2026-05-30',
        remainingCents: 600_00,
        actualMonthlyCents: 300_00,
      }),
    ).toBe('on-track');
  });
});

describe('monthToDeadlineIso', () => {
  it('U-DL17 — converte YYYY-MM para o último dia do mês', () => {
    expect(monthToDeadlineIso('2026-12')).toBe('2026-12-31');
    expect(monthToDeadlineIso('2026-02')).toBe('2026-02-28');
    expect(monthToDeadlineIso('2028-02')).toBe('2028-02-29');
  });
});

describe('daysUntil', () => {
  it('U-DL18 — dias inteiros entre hoje e a meta', () => {
    expect(daysUntil('2026-06-09', '2026-05-30')).toBe(10);
    expect(daysUntil('2026-05-30', '2026-05-30')).toBe(0);
    expect(daysUntil('2026-05-20', '2026-05-30')).toBe(-10);
  });
});

describe('formatDeadlineMonth', () => {
  it('U-DL19 — formata mês curto pt-BR com ano de 2 dígitos', () => {
    expect(formatDeadlineMonth('2026-12-31')).toBe('dez/26');
    expect(formatDeadlineMonth('2027-03')).toBe('mar/27');
  });
});
