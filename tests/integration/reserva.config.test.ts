import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setCategoryEssentialCore } from '@/server/actions/reserva/core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('categories')
    .update({ is_essential: false })
    .eq('id', SEED_CATEGORY_MERCADO_ID);
}

describe('reserva config (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RESCFG2 — marcar e desmarcar categoria essencial', async () => {
    const supabase = await getAuthedClient();

    const on = await setCategoryEssentialCore(
      { supabase, session: SEED_SESSION },
      { categoryId: SEED_CATEGORY_MERCADO_ID, isEssential: true },
    );
    expect(on.ok).toBe(true);

    const admin = getAdminClient();
    const { data: afterOn } = await admin
      .from('categories')
      .select('is_essential')
      .eq('id', SEED_CATEGORY_MERCADO_ID)
      .single();
    expect(afterOn?.is_essential).toBe(true);

    const off = await setCategoryEssentialCore(
      { supabase, session: SEED_SESSION },
      { categoryId: SEED_CATEGORY_MERCADO_ID, isEssential: false },
    );
    expect(off.ok).toBe(true);

    const { data: afterOff } = await admin
      .from('categories')
      .select('is_essential')
      .eq('id', SEED_CATEGORY_MERCADO_ID)
      .single();
    expect(afterOff?.is_essential).toBe(false);
  });

  it('I-RESCFG3 — categoria de outro household → not found', async () => {
    const supabase = await getAuthedClient();
    const result = await setCategoryEssentialCore(
      { supabase, session: SEED_SESSION },
      { categoryId: '00000000-0000-4000-8000-0000000000ff', isEssential: true },
    );
    expect(result.ok).toBe(false);
  });
});
