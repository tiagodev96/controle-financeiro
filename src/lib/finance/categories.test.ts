import { describe, it, expect, vi } from 'vitest';
import { listTopCategoriesForHousehold } from './categories';

function makeCategoriesChain(result: { data: unknown; error: { message: string } | null }) {
  const eq3 = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

function makeTransactionsChain(result: { data: unknown; error: { message: string } | null }) {
  const not = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ not });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function makeFake(
  catResult: { data: unknown; error: { message: string } | null },
  txResult: { data: unknown; error: { message: string } | null } = { data: [], error: null }
) {
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'categories') return makeCategoriesChain(catResult);
    if (table === 'transactions') return makeTransactionsChain(txResult);
    throw new Error(`unexpected table: ${table}`);
  });
  return { from };
}

describe('listTopCategoriesForHousehold (unit, ramos de erro)', () => {
  it('lança erro quando a query de categories falha', async () => {
    const fake = makeFake({ data: null, error: { message: 'rls denied' } });
    await expect(
      listTopCategoriesForHousehold(fake as never, 'household-x', 6)
    ).rejects.toThrow(/rls denied/);
  });

  it('lança erro quando a query de transactions falha', async () => {
    const fake = makeFake(
      { data: [], error: null },
      { data: null, error: { message: 'tx query down' } }
    );
    await expect(
      listTopCategoriesForHousehold(fake as never, 'household-x', 6)
    ).rejects.toThrow(/tx query down/);
  });

  it('retorna [] quando data de categories é null sem error', async () => {
    const fake = makeFake({ data: null, error: null });
    const result = await listTopCategoriesForHousehold(fake as never, 'household-x', 6);
    expect(result).toEqual([]);
  });

  it('ignora transactions com category_id null e trata categoria com sort_order null', async () => {
    const fake = makeFake(
      {
        data: [{ id: 'c-1', name: 'SemOrdem', sort_order: null }],
        error: null,
      },
      {
        data: [{ category_id: null }, { category_id: 'c-1' }],
        error: null,
      }
    );
    const result = await listTopCategoriesForHousehold(fake as never, 'household-x', 6);
    expect(result).toEqual([{ id: 'c-1', name: 'SemOrdem' }]);
  });
});
