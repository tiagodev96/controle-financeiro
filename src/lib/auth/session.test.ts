import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSession, UnauthorizedError } from './session';
import { getServerSupabase } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(),
}));

const mockedGetServerSupabase = vi.mocked(getServerSupabase);

type FakeClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

function makeFakeClient(opts: {
  userResult: { data: { user: { id: string } | null }; error: Error | null };
  profileResult?: {
    data: { household_id: string; preferred_display_currency?: string } | null;
    error: Error | null;
  };
}): FakeClient {
  const single = vi.fn().mockResolvedValue(
    opts.profileResult ?? { data: null, error: null }
  );
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    auth: { getUser: vi.fn().mockResolvedValue(opts.userResult) },
    from,
  };
}

describe('getSession', () => {
  beforeEach(() => {
    mockedGetServerSupabase.mockReset();
  });

  it('retorna userId, householdId e preferredDisplayCurrency quando usuário e profile existem', async () => {
    const client = makeFakeClient({
      userResult: { data: { user: { id: 'user-1' } }, error: null },
      profileResult: {
        data: { household_id: 'household-1', preferred_display_currency: 'BRL' },
        error: null,
      },
    });
    mockedGetServerSupabase.mockResolvedValue(client as never);

    const session = await getSession();

    expect(session).toEqual({
      userId: 'user-1',
      householdId: 'household-1',
      preferredDisplayCurrency: 'BRL',
    });
    expect(client.from).toHaveBeenCalledWith('profiles');
  });

  it('lança UnauthorizedError quando auth.getUser retorna erro', async () => {
    const client = makeFakeClient({
      userResult: { data: { user: null }, error: new Error('jwt expired') },
    });
    mockedGetServerSupabase.mockResolvedValue(client as never);

    await expect(getSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lança UnauthorizedError quando não há usuário autenticado', async () => {
    const client = makeFakeClient({
      userResult: { data: { user: null }, error: null },
    });
    mockedGetServerSupabase.mockResolvedValue(client as never);

    await expect(getSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lança UnauthorizedError com "Profile not found" quando profile não existe', async () => {
    const client = makeFakeClient({
      userResult: { data: { user: { id: 'user-1' } }, error: null },
      profileResult: { data: null, error: null },
    });
    mockedGetServerSupabase.mockResolvedValue(client as never);

    await expect(getSession()).rejects.toMatchObject({
      name: 'UnauthorizedError',
      message: 'Profile not found',
    });
  });

  it('lança UnauthorizedError quando a query de profile retorna erro', async () => {
    const client = makeFakeClient({
      userResult: { data: { user: { id: 'user-1' } }, error: null },
      profileResult: { data: null, error: new Error('db down') },
    });
    mockedGetServerSupabase.mockResolvedValue(client as never);

    await expect(getSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
