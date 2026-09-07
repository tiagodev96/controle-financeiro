import { describe, it, expect } from 'vitest';
import { buildInvoiceChartMonths } from './invoice-chart';

// Cartão fecha 7 / vence 11; mês aberto de referência: setembro/2026.
const OPEN = '2026-09';

describe('buildInvoiceChartMonths', () => {
  it('U-ICH1 — classifica passada, aberta e futuras a partir do mês aberto', () => {
    const months = buildInvoiceChartMonths(
      [
        { dueOn: '2026-08-11', totalCents: 10000 },
        { dueOn: '2026-09-11', totalCents: 20000 },
        { dueOn: '2026-10-11', totalCents: 5000 },
        { dueOn: '2026-11-11', totalCents: 3000 },
      ],
      { openMonthIso: OPEN },
    );
    expect(months).toEqual([
      { monthIso: '2026-08', totalCents: 10000, state: 'past' },
      { monthIso: '2026-09', totalCents: 20000, state: 'open' },
      { monthIso: '2026-10', totalCents: 5000, state: 'future' },
      { monthIso: '2026-11', totalCents: 3000, state: 'future' },
    ]);
  });

  it('U-ICH2 — mostra no máximo 2 meses pra trás', () => {
    const months = buildInvoiceChartMonths(
      [
        { dueOn: '2026-05-11', totalCents: 1 },
        { dueOn: '2026-06-11', totalCents: 2 },
        { dueOn: '2026-07-11', totalCents: 3 },
        { dueOn: '2026-08-11', totalCents: 4 },
        { dueOn: '2026-09-11', totalCents: 5 },
      ],
      { openMonthIso: OPEN },
    );
    expect(months.map((m) => m.monthIso)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(months[0]!.state).toBe('past');
  });

  it('U-ICH3 — preenche mês sem fatura com zero pra manter o eixo contíguo', () => {
    const months = buildInvoiceChartMonths(
      [
        { dueOn: '2026-08-11', totalCents: 100 },
        { dueOn: '2026-10-11', totalCents: 300 },
      ],
      { openMonthIso: OPEN },
    );
    expect(months).toEqual([
      { monthIso: '2026-08', totalCents: 100, state: 'past' },
      { monthIso: '2026-09', totalCents: 0, state: 'open' },
      { monthIso: '2026-10', totalCents: 300, state: 'future' },
    ]);
  });

  it('U-ICH4 — soma faturas do mesmo mês (mais de um cartão)', () => {
    const months = buildInvoiceChartMonths(
      [
        { dueOn: '2026-09-11', totalCents: 100 },
        { dueOn: '2026-09-15', totalCents: 50 },
      ],
      { openMonthIso: OPEN },
    );
    expect(months).toEqual([{ monthIso: '2026-09', totalCents: 150, state: 'open' }]);
  });

  it('U-ICH5 — sem faturas retorna vazio', () => {
    expect(buildInvoiceChartMonths([], { openMonthIso: OPEN })).toEqual([]);
  });

  it('U-ICH6 — só faturas futuras: inclui o mês aberto zerado como âncora', () => {
    const months = buildInvoiceChartMonths(
      [
        { dueOn: '2026-11-11', totalCents: 500 },
        { dueOn: '2026-12-11', totalCents: 500 },
      ],
      { openMonthIso: OPEN },
    );
    expect(months.map((m) => [m.monthIso, m.totalCents, m.state])).toEqual([
      ['2026-09', 0, 'open'],
      ['2026-10', 0, 'future'],
      ['2026-11', 500, 'future'],
      ['2026-12', 500, 'future'],
    ]);
  });

  it('U-ICH7 — virada de ano na janela futura', () => {
    const months = buildInvoiceChartMonths(
      [
        { dueOn: '2026-12-11', totalCents: 100 },
        { dueOn: '2027-01-11', totalCents: 200 },
      ],
      { openMonthIso: '2026-12' },
    );
    expect(months).toEqual([
      { monthIso: '2026-12', totalCents: 100, state: 'open' },
      { monthIso: '2027-01', totalCents: 200, state: 'future' },
    ]);
  });
});
