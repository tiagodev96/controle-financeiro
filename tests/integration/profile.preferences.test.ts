import { describe, it, expect, afterEach } from 'vitest';
import { setPreferredDisplayCurrencyCore } from '@/server/actions/profile/preferences-core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_USER_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function resetPref(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('profiles')
    .update({ preferred_display_currency: 'EUR' })
    .eq('id', SEED_USER_ID);
}

describe('setPreferredDisplayCurrencyCore (integração)', () => {
  afterEach(resetPref);

  it('I-PREF1 — salva BRL no profile do usuário autenticado', async () => {
    const supabase = await getAuthedClient();
    const result = await setPreferredDisplayCurrencyCore(
      { supabase, session: SEED_SESSION },
      { currency: 'BRL' },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('preferred_display_currency')
      .eq('id', SEED_USER_ID)
      .single();
    expect(data?.preferred_display_currency).toBe('BRL');
  });

  it('I-PREF2 — rejeita currency fora de EUR/BRL', async () => {
    const supabase = await getAuthedClient();
    const result = await setPreferredDisplayCurrencyCore(
      { supabase, session: SEED_SESSION },
      // @ts-expect-error caso garantido pelo runtime
      { currency: 'USD' },
    );
    expect(result.ok).toBe(false);
  });
});
