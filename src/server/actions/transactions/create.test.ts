import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransaction } from './create';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { getServerSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createTransactionForSession } from './create-core';

vi.mock('@/lib/auth/session', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/session')>(
    '@/lib/auth/session'
  );
  return {
    ...actual,
    getSession: vi.fn(),
  };
});
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('./create-core', () => ({ createTransactionForSession: vi.fn() }));

const mockedGetSession = vi.mocked(getSession);
const mockedGetServerSupabase = vi.mocked(getServerSupabase);
const mockedCookies = vi.mocked(cookies);
const mockedRevalidate = vi.mocked(revalidatePath);
const mockedCore = vi.mocked(createTransactionForSession);

const baseInput = {
  amountCents: 1250,
  description: 'Pão',
  categoryId: '33333333-3333-4333-8333-333333333001',
  accountId: '22222222-2222-4222-8222-222222222001',
  paid: false,
  date: '2026-05-24',
};

describe('createTransaction (Server Action wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no sucesso: seta cookie cf_last_account_id e revalida o dashboard', async () => {
    const cookieSet = vi.fn();
    mockedCookies.mockResolvedValue({ set: cookieSet } as never);
    mockedGetSession.mockResolvedValue({ userId: 'u-1', householdId: 'h-1', displayName: 'Owner', preferredDisplayCurrency: 'EUR' });
    mockedGetServerSupabase.mockResolvedValue({} as never);
    mockedCore.mockResolvedValue({
      ok: true,
      transaction: { id: 'tx-1', account_id: baseInput.accountId } as never,
    });

    const result = await createTransaction(baseInput);

    expect(result.ok).toBe(true);
    expect(cookieSet).toHaveBeenCalledWith(
      'cf_last_account_id',
      baseInput.accountId,
      expect.objectContaining({ path: '/', sameSite: 'lax' })
    );
    expect(mockedRevalidate).toHaveBeenCalledWith('/');
    expect(mockedRevalidate).toHaveBeenCalledWith('/transacoes');
  });

  it('no fracasso da action core: não seta cookie nem revalida, propaga erro', async () => {
    const cookieSet = vi.fn();
    mockedCookies.mockResolvedValue({ set: cookieSet } as never);
    mockedGetSession.mockResolvedValue({ userId: 'u-1', householdId: 'h-1', displayName: 'Owner', preferredDisplayCurrency: 'EUR' });
    mockedGetServerSupabase.mockResolvedValue({} as never);
    mockedCore.mockResolvedValue({ ok: false, error: 'Categoria inválida' });

    const result = await createTransaction(baseInput);

    expect(result).toEqual({ ok: false, error: 'Categoria inválida' });
    expect(cookieSet).not.toHaveBeenCalled();
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('quando getSession lança UnauthorizedError: retorna ok:false sem chamar core', async () => {
    mockedGetSession.mockRejectedValue(new UnauthorizedError());

    const result = await createTransaction(baseInput);

    expect(result).toEqual({ ok: false, error: 'Sessão expirada. Entre novamente.' });
    expect(mockedCore).not.toHaveBeenCalled();
  });

  it('quando getSession lança outro erro: propaga', async () => {
    mockedGetSession.mockRejectedValue(new Error('db down'));

    await expect(createTransaction(baseInput)).rejects.toThrow('db down');
  });
});
