import { describe, it, expect } from 'vitest';
import { planPaymentCoverage, type CoverageAccount } from './payment-coverage';

const RATE_MAP = { EUR_BRL: 6, BRL_EUR: 1 / 6 };

const BRL1 = 'aaaa1111-0000-4000-8000-000000000001';
const BRL2 = 'aaaa1111-0000-4000-8000-000000000002';
const BRL3 = 'aaaa1111-0000-4000-8000-000000000003';
const EUR1 = 'bbbb2222-0000-4000-8000-000000000001';

function brl(id: string, balanceCents: number, sortOrder: number): CoverageAccount {
  return { id, currency: 'BRL', balanceCents, sortOrder };
}
function eur(id: string, balanceCents: number, sortOrder: number): CoverageAccount {
  return { id, currency: 'EUR', balanceCents, sortOrder };
}

describe('planPaymentCoverage', () => {
  it('U-COV1 — déficit zero (conta cobre): nenhuma transferência', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 5000, 1), eur(EUR1, 10_000, 2)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([]);
  });

  it('U-COV2 — cobertura total na mesma moeda (sem câmbio)', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 0, 1), brl(BRL2, 5000, 2)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([
      {
        fromAccountId: BRL2,
        toAccountId: BRL1,
        fromAmountCents: 1200,
        toAmountCents: 1200,
        fromCurrency: 'BRL',
        toCurrency: 'BRL',
        rate: null,
      },
    ]);
  });

  it('U-COV3 — cobertura total via conversão EUR→BRL (€100/R$0, paga R$12)', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 0, 2), eur(EUR1, 10_000, 1)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([
      {
        fromAccountId: EUR1,
        toAccountId: BRL1,
        fromAmountCents: 200,
        toAmountCents: 1200,
        fromCurrency: 'EUR',
        toCurrency: 'BRL',
        rate: 6,
      },
    ]);
  });

  it('U-COV4 — cobertura parcial mista: usa R$5 próprios e converte os R$7 restantes', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 500, 2), eur(EUR1, 10_000, 1)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([
      {
        fromAccountId: EUR1,
        toAccountId: BRL1,
        fromAmountCents: 117,
        toAmountCents: 700,
        fromCurrency: 'EUR',
        toCurrency: 'BRL',
        rate: 6,
      },
    ]);
  });

  it('U-COV5 — mesma moeda antes de outra moeda, mesmo com sort_order pior', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 0, 1), eur(EUR1, 10_000, 2), brl(BRL2, 800, 3)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([
      {
        fromAccountId: BRL2,
        toAccountId: BRL1,
        fromAmountCents: 800,
        toAmountCents: 800,
        fromCurrency: 'BRL',
        toCurrency: 'BRL',
        rate: null,
      },
      {
        fromAccountId: EUR1,
        toAccountId: BRL1,
        fromAmountCents: 67,
        toAmountCents: 400,
        fromCurrency: 'EUR',
        toCurrency: 'BRL',
        rate: 6,
      },
    ]);
  });

  it('U-COV6 — origem insuficiente: cobre o que dá, resto fica descoberto', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 0, 1), brl(BRL2, 500, 2)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([
      {
        fromAccountId: BRL2,
        toAccountId: BRL1,
        fromAmountCents: 500,
        toAmountCents: 500,
        fromCurrency: 'BRL',
        toCurrency: 'BRL',
        rate: null,
      },
    ]);
  });

  it('U-COV7 — múltiplas contas da mesma moeda drenadas por sort_order', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1000,
      accounts: [brl(BRL1, 0, 1), brl(BRL2, 400, 5), brl(BRL3, 400, 2)],
      rateMap: RATE_MAP,
    });
    expect(transfers.map((t) => t.fromAccountId)).toEqual([BRL3, BRL2]);
    expect(transfers.map((t) => t.toAmountCents)).toEqual([400, 400]);
  });

  it('U-COV8 — câmbio indisponível e só há origem em outra moeda: não converte', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1200,
      accounts: [brl(BRL1, 0, 1), eur(EUR1, 10_000, 2)],
      rateMap: null,
    });
    expect(transfers).toEqual([]);
  });

  it('U-COV9 — conversão na direção inversa BRL→EUR (paga €1 com R$)', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: EUR1,
      amountCents: 100,
      accounts: [eur(EUR1, 0, 1), brl(BRL1, 100_000, 2)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([
      {
        fromAccountId: BRL1,
        toAccountId: EUR1,
        fromAmountCents: 600,
        toAmountCents: 100,
        fromCurrency: 'BRL',
        toCurrency: 'EUR',
        rate: 1 / 6,
      },
    ]);
  });

  it('U-COV10 — ignora contas com saldo zero ou negativo como origem', () => {
    const transfers = planPaymentCoverage({
      expenseAccountId: BRL1,
      amountCents: 1000,
      accounts: [brl(BRL1, 0, 1), brl(BRL2, 0, 2), brl(BRL3, -500, 3)],
      rateMap: RATE_MAP,
    });
    expect(transfers).toEqual([]);
  });
});
