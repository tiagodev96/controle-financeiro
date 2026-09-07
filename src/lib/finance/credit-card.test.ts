import { describe, it, expect } from 'vitest';
import { bestPurchaseDay, cycleForDueDate, cycleForPurchase, openCycleOn } from './credit-card';

// Cartão de referência do PRD: fecha dia 7, vence dia 11. O dia do fechamento
// é EXCLUSIVO: compra no dia 7 já cai na fatura seguinte.
const CLOSING = 7;
const DUE = 11;

describe('cycleForPurchase', () => {
  it('U-CC1 — compra dia 6 cai no ciclo que fecha dia 7 e vence dia 11 do mesmo mês', () => {
    expect(cycleForPurchase('2026-08-06', CLOSING, DUE)).toEqual({
      opensOn: '2026-07-07',
      closesOn: '2026-08-07',
      dueOn: '2026-08-11',
    });
  });

  it('U-CC2 — compra no próprio dia do fechamento já cai na fatura seguinte', () => {
    expect(cycleForPurchase('2026-08-07', CLOSING, DUE)).toEqual({
      opensOn: '2026-08-07',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
  });

  it('U-CC3 — compra dia 8 cai no ciclo seguinte: fecha 07/09, vence 11/09', () => {
    expect(cycleForPurchase('2026-08-08', CLOSING, DUE)).toEqual({
      opensOn: '2026-08-07',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
  });

  it('U-CC4 — virada de ano: compra 08/dez fecha 07/jan e vence 11/jan', () => {
    expect(cycleForPurchase('2026-12-08', CLOSING, DUE)).toEqual({
      opensOn: '2026-12-07',
      closesOn: '2027-01-07',
      dueOn: '2027-01-11',
    });
  });

  it('U-CC5 — dueDay < closingDay: fecha dia 28, vence dia 5 do mês seguinte', () => {
    expect(cycleForPurchase('2026-08-10', 28, 5)).toEqual({
      opensOn: '2026-07-28',
      closesOn: '2026-08-28',
      dueOn: '2026-09-05',
    });
  });

  it('U-CC6 — clamp: closingDay 31 em fevereiro fecha no dia 28', () => {
    expect(cycleForPurchase('2026-02-10', 31, 5)).toEqual({
      opensOn: '2026-01-31',
      closesOn: '2026-02-28',
      dueOn: '2026-03-05',
    });
  });

  it('U-CC6b — compra no dia do fechamento clampado (28/fev) já cai no ciclo de março', () => {
    expect(cycleForPurchase('2026-02-28', 31, 5).closesOn).toBe('2026-03-31');
  });

  it('U-CC6c — opensOn com fechamento clampado: ciclo de março abre 28/02', () => {
    expect(cycleForPurchase('2026-03-15', 31, 5)).toEqual({
      opensOn: '2026-02-28',
      closesOn: '2026-03-31',
      dueOn: '2026-04-05',
    });
  });
});

describe('bestPurchaseDay', () => {
  it('U-CC7 — melhor dia é o próprio dia do fechamento (primeiro dia do ciclo novo)', () => {
    expect(bestPurchaseDay(7)).toBe(7);
    expect(bestPurchaseDay(31)).toBe(31);
  });
});

describe('cycleForDueDate', () => {
  it('U-CC9 — reconstrói o ciclo a partir do vencimento (inverso do cálculo da compra)', () => {
    expect(cycleForDueDate('2026-09-11', CLOSING, DUE)).toEqual({
      opensOn: '2026-08-07',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
    // dueDay < closingDay: vence 05/09 → fechou 28/08.
    expect(cycleForDueDate('2026-09-05', 28, 5)).toEqual({
      opensOn: '2026-07-28',
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
      opensOn: '2026-08-07',
      closesOn: '2026-09-07',
      dueOn: '2026-09-11',
    });
    expect(openCycleOn('2026-08-03', CLOSING, DUE).dueOn).toBe('2026-08-11');
  });
});
