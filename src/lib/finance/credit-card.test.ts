import { describe, it, expect } from 'vitest';
import { bestPurchaseDay, cycleForDueDate, cycleForPurchase, openCycleOn } from './credit-card';

// Cartão de referência do PRD: fecha dia 7, vence dia 11.
const CLOSING = 7;
const DUE = 11;

describe('cycleForPurchase', () => {
  it('U-CC1 — compra dia 6 cai no ciclo que fecha dia 7 e vence dia 11 do mesmo mês', () => {
    expect(cycleForPurchase('2026-08-06', CLOSING, DUE)).toEqual({
      opensOn: '2026-07-08',
      closesOn: '2026-08-07',
      dueOn: '2026-08-11',
    });
  });

  it('U-CC2 — compra no próprio dia do fechamento ainda entra no ciclo (inclusivo)', () => {
    expect(cycleForPurchase('2026-08-07', CLOSING, DUE)).toEqual({
      opensOn: '2026-07-08',
      closesOn: '2026-08-07',
      dueOn: '2026-08-11',
    });
  });

  it('U-CC3 — compra dia 8 cai no ciclo seguinte: fecha 07/09, vence 11/09', () => {
    expect(cycleForPurchase('2026-08-08', CLOSING, DUE)).toEqual({
      opensOn: '2026-08-08',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
  });

  it('U-CC4 — virada de ano: compra 08/dez fecha 07/jan e vence 11/jan', () => {
    expect(cycleForPurchase('2026-12-08', CLOSING, DUE)).toEqual({
      opensOn: '2026-12-08',
      closesOn: '2027-01-07',
      dueOn: '2027-01-11',
    });
  });

  it('U-CC5 — dueDay < closingDay: fecha dia 28, vence dia 5 do mês seguinte', () => {
    expect(cycleForPurchase('2026-08-10', 28, 5)).toEqual({
      opensOn: '2026-07-29',
      closesOn: '2026-08-28',
      dueOn: '2026-09-05',
    });
  });

  it('U-CC6 — clamp: closingDay 31 em fevereiro fecha no dia 28', () => {
    expect(cycleForPurchase('2026-02-10', 31, 5)).toEqual({
      opensOn: '2026-02-01',
      closesOn: '2026-02-28',
      dueOn: '2026-03-05',
    });
  });

  it('U-CC6b — compra no dia do fechamento clampado (28/fev) ainda é inclusiva', () => {
    expect(cycleForPurchase('2026-02-28', 31, 5).closesOn).toBe('2026-02-28');
  });

  it('U-CC6c — opensOn após fechamento clampado: ciclo de março abre 01/03', () => {
    expect(cycleForPurchase('2026-03-15', 31, 5)).toEqual({
      opensOn: '2026-03-01',
      closesOn: '2026-03-31',
      dueOn: '2026-04-05',
    });
  });
});

describe('bestPurchaseDay', () => {
  it('U-CC7 — dia seguinte ao fechamento; fecha dia 31 → melhor dia é 1', () => {
    expect(bestPurchaseDay(7)).toBe(8);
    expect(bestPurchaseDay(31)).toBe(1);
  });
});

describe('cycleForDueDate', () => {
  it('U-CC9 — reconstrói o ciclo a partir do vencimento (inverso do cálculo da compra)', () => {
    expect(cycleForDueDate('2026-09-11', CLOSING, DUE)).toEqual({
      opensOn: '2026-08-08',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
    // dueDay < closingDay: vence 05/09 → fechou 28/08.
    expect(cycleForDueDate('2026-09-05', 28, 5)).toEqual({
      opensOn: '2026-07-29',
      closesOn: '2026-08-28',
      dueOn: '2026-09-05',
    });
    // Virada de ano ao voltar um mês: vence 05/01 → fechou 28/12.
    expect(cycleForDueDate('2027-01-05', 28, 5).closesOn).toBe('2026-12-28');
  });
});

describe('openCycleOn', () => {
  it('U-CC8 — ciclo aberto de hoje é o ciclo em que uma compra de hoje cairia', () => {
    expect(openCycleOn('2026-08-16', CLOSING, DUE)).toEqual({
      opensOn: '2026-08-08',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
    expect(openCycleOn('2026-08-03', CLOSING, DUE).dueOn).toBe('2026-08-11');
  });
});
