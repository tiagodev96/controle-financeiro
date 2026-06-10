import { describe, it, expect } from 'vitest';
import {
  MONTHS_PT,
  MONTHS_PT_SHORT,
  toIsoDate,
  toLocalIsoDate,
  monthIso,
  monthRange,
  monthRangeFromIso,
  addMonths,
  endOfMonth,
  parseMonthParam,
  parseMoedaParam,
  monthEyebrow,
} from './dates';

describe('MONTHS_PT / MONTHS_PT_SHORT', () => {
  it('U-DT1 — 12 meses, pt-BR minúsculo', () => {
    expect(MONTHS_PT).toHaveLength(12);
    expect(MONTHS_PT[0]).toBe('janeiro');
    expect(MONTHS_PT[11]).toBe('dezembro');
    expect(MONTHS_PT_SHORT).toHaveLength(12);
    expect(MONTHS_PT_SHORT[5]).toBe('jun');
  });
});

describe('toIsoDate', () => {
  it('U-DT2 — data UTC vira YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 5, 9, 12, 0, 0)))).toBe('2026-06-09');
  });
});

describe('toLocalIsoDate', () => {
  it('U-DT18 — usa o dia local, não o UTC', () => {
    // Meia-noite e meia local: o dia local é o que vale, independente do fuso.
    const d = new Date(2026, 5, 9, 0, 30, 0);
    expect(toLocalIsoDate(d)).toBe('2026-06-09');
  });
});

describe('monthIso', () => {
  it('U-DT3 — usa componentes locais, com zero à esquerda', () => {
    expect(monthIso(new Date(2026, 5, 9))).toBe('2026-06');
    expect(monthIso(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('monthRange', () => {
  it('U-DT4 — primeiro dia do mês até primeiro do mês seguinte', () => {
    expect(monthRange(new Date(2026, 5, 9))).toEqual({
      start: '2026-06-01',
      end: '2026-07-01',
    });
  });

  it('U-DT5 — dezembro vira janeiro do ano seguinte', () => {
    expect(monthRange(new Date(2026, 11, 25))).toEqual({
      start: '2026-12-01',
      end: '2027-01-01',
    });
  });

  it('U-DT6 — borda de timezone: meia-noite local do dia 1 não desloca o mês', () => {
    // Construído de componentes locais — toISOString deslocaria pra UTC e
    // poderia cair no mês anterior em fusos positivos.
    expect(monthRange(new Date(2026, 5, 1, 0, 0, 0))).toEqual({
      start: '2026-06-01',
      end: '2026-07-01',
    });
  });
});

describe('monthRangeFromIso', () => {
  it('U-DT7 — mesmo intervalo a partir de YYYY-MM', () => {
    expect(monthRangeFromIso('2026-06')).toEqual({
      start: '2026-06-01',
      end: '2026-07-01',
    });
    expect(monthRangeFromIso('2026-12')).toEqual({
      start: '2026-12-01',
      end: '2027-01-01',
    });
  });

  it('U-DT8 — lança em monthIso inválido', () => {
    expect(() => monthRangeFromIso('garbage')).toThrow();
  });
});

describe('addMonths', () => {
  it('U-DT9 — soma e subtrai cruzando ano', () => {
    expect(addMonths('2026-06', -1)).toBe('2026-05');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-06', 14)).toBe('2027-08');
    expect(addMonths('2026-06', 0)).toBe('2026-06');
  });
});

describe('endOfMonth', () => {
  it('U-DT10 — último dia do mês, inclusive fevereiro bissexto', () => {
    expect(endOfMonth(new Date(2026, 5, 9)).getDate()).toBe(30);
    expect(endOfMonth(new Date(2026, 0, 1)).getDate()).toBe(31);
    expect(endOfMonth(new Date(2028, 1, 10)).getDate()).toBe(29);
  });
});

describe('parseMonthParam', () => {
  const now = new Date(2026, 5, 9); // junho 2026

  it('U-DT11 — sem param: mês corrente, sem past/future', () => {
    expect(parseMonthParam(undefined, now)).toEqual({
      targetDate: now,
      monthIso: '2026-06',
      isPast: false,
      isFuture: false,
    });
    expect(parseMonthParam(null, now).monthIso).toBe('2026-06');
  });

  it('U-DT12 — param inválido cai no mês corrente', () => {
    expect(parseMonthParam('garbage', now).monthIso).toBe('2026-06');
    expect(parseMonthParam('2026-13', now).monthIso).toBe('2026-06');
    expect(parseMonthParam('2026-00', now).monthIso).toBe('2026-06');
  });

  it('U-DT13 — mês corrente explícito: targetDate é o próprio now', () => {
    const result = parseMonthParam('2026-06', now);
    expect(result.targetDate).toBe(now);
    expect(result.isPast).toBe(false);
    expect(result.isFuture).toBe(false);
  });

  it('U-DT14 — mês passado: targetDate é o último dia do mês alvo', () => {
    const result = parseMonthParam('2026-01', now);
    expect(result.monthIso).toBe('2026-01');
    expect(result.isPast).toBe(true);
    expect(result.isFuture).toBe(false);
    expect(result.targetDate.getFullYear()).toBe(2026);
    expect(result.targetDate.getMonth()).toBe(0);
    expect(result.targetDate.getDate()).toBe(31);
  });

  it('U-DT15 — mês futuro', () => {
    const result = parseMonthParam('2026-09', now);
    expect(result.isFuture).toBe(true);
    expect(result.isPast).toBe(false);
    expect(result.targetDate.getDate()).toBe(30);
  });
});

describe('parseMoedaParam', () => {
  it('U-DT16 — aceita maiúscula e minúscula, senão fallback', () => {
    expect(parseMoedaParam('EUR', 'BRL')).toBe('EUR');
    expect(parseMoedaParam('eur', 'BRL')).toBe('EUR');
    expect(parseMoedaParam('BRL', 'EUR')).toBe('BRL');
    expect(parseMoedaParam('brl', 'EUR')).toBe('BRL');
    expect(parseMoedaParam('usd', 'EUR')).toBe('EUR');
    expect(parseMoedaParam(undefined, 'BRL')).toBe('BRL');
    expect(parseMoedaParam(null, 'EUR')).toBe('EUR');
  });
});

describe('monthEyebrow', () => {
  it('U-DT17 — "junho · 2026"', () => {
    expect(monthEyebrow(new Date(2026, 5, 9))).toBe('junho · 2026');
  });
});
