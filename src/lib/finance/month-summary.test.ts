import { describe, it, expect } from 'vitest';
import { buildMonthSummaryText, type MonthSummaryInput } from './month-summary';

const NOW = new Date(2026, 4, 15); // maio · 2026

function base(): MonthSummaryInput {
  return {
    now: NOW,
    primaryCurrency: 'EUR',
    saldoPrevistoFimDoMesCents: 342015,
    sobraPrevistaCents: 28040,
    entradasMesCents: 280000,
    despesasPaidCents: 120000,
    despesasPendingCents: 32060,
    overdueCents: 0,
    overdueCount: 0,
    topCategories: [
      { name: 'Mercado', totalCents: 48020 },
      { name: 'Restaurantes', totalCents: 21590 },
      { name: 'Casa', totalCents: 18000 },
    ],
    openDebts: [
      { id: 'd1', title: 'Jefferson', currency: 'BRL', remainingCents: 240000 },
      { id: 'd2', title: 'Cartão', currency: 'BRL', remainingCents: 32000 },
    ],
    debtPaymentsByDebtId: { d1: 60000 },
    accounts: [
      { name: 'Itaú', currency: 'BRL', balanceCents: 182000 },
      { name: 'Wise EUR', currency: 'EUR', balanceCents: 160015 },
    ],
  };
}

describe('buildMonthSummaryText', () => {
  it('U-RES1 — formato base completo com todas as seções', () => {
    const text = buildMonthSummaryText(base());
    expect(text).toBe(
      [
        'Resumo de maio · 2026',
        '',
        'Saldo previsto fim do mês: € 3.420,15',
        'Sobra prevista: € 280,40',
        '',
        'Entradas: € 2.800,00',
        'Despesas: € 1.520,60 (já pago: € 1.200,00, pendente: € 320,60)',
        '',
        'Top categorias:',
        '- Mercado: € 480,20',
        '- Restaurantes: € 215,90',
        '- Casa: € 180,00',
        '',
        'Dívidas abertas:',
        '- Jefferson: R$ 2.400,00 restante (pago este mês: R$ 600,00)',
        '- Cartão: R$ 320,00 restante',
        '',
        'Contas:',
        '- Itaú: R$ 1.820,00',
        '- Wise EUR: € 1.600,15',
      ].join('\n'),
    );
  });

  it('U-RES2 — omite seção "Top categorias" quando array vazio', () => {
    const text = buildMonthSummaryText({ ...base(), topCategories: [] });
    expect(text).not.toContain('Top categorias');
    expect(text).toContain('Despesas:');
    expect(text).toContain('Dívidas abertas:');
  });

  it('U-RES3 — omite seção "Dívidas abertas" quando zero abertas', () => {
    const text = buildMonthSummaryText({
      ...base(),
      openDebts: [],
      debtPaymentsByDebtId: {},
    });
    expect(text).not.toContain('Dívidas abertas');
    expect(text).toContain('Top categorias:');
    expect(text).toContain('Contas:');
  });

  it('U-RES4 — linha "Em atraso" só aparece se overdueCount > 0', () => {
    const semAtraso = buildMonthSummaryText(base());
    expect(semAtraso).not.toContain('Em atraso');

    const comAtraso = buildMonthSummaryText({
      ...base(),
      overdueCents: 5000,
      overdueCount: 2,
    });
    expect(comAtraso).toContain('Em atraso: € 50,00 (2 transações)');
    // Vem logo após a linha de Despesas, antes do bloco Top categorias.
    const lines = comAtraso.split('\n');
    const despesasIdx = lines.findIndex((l) => l.startsWith('Despesas:'));
    const atrasoIdx = lines.findIndex((l) => l.startsWith('Em atraso:'));
    expect(atrasoIdx).toBe(despesasIdx + 1);
  });

  it('U-RES5 — "(pago este mês: ...)" só aparece quando há pagamento no mês', () => {
    const text = buildMonthSummaryText(base());
    expect(text).toContain('Jefferson: R$ 2.400,00 restante (pago este mês: R$ 600,00)');
    expect(text).toContain('Cartão: R$ 320,00 restante');
    expect(text).not.toContain('Cartão: R$ 320,00 restante (pago este mês');
  });

  it('U-RES6 — contas listam cada uma na sua currency, mantendo ordem do input', () => {
    const text = buildMonthSummaryText({
      ...base(),
      accounts: [
        { name: 'Itaú', currency: 'BRL', balanceCents: 100000 },
        { name: 'Nubank', currency: 'BRL', balanceCents: 50050 },
        { name: 'Wise EUR', currency: 'EUR', balanceCents: 250000 },
      ],
    });
    const idxItau = text.indexOf('- Itaú: R$ 1.000,00');
    const idxNu = text.indexOf('- Nubank: R$ 500,50');
    const idxWise = text.indexOf('- Wise EUR: € 2.500,00');
    expect(idxItau).toBeGreaterThan(0);
    expect(idxNu).toBeGreaterThan(idxItau);
    expect(idxWise).toBeGreaterThan(idxNu);
  });
});
