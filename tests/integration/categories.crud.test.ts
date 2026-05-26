import { describe, it, expect, afterEach } from 'vitest';
import {
  createCategoryCore,
  renameCategoryCore,
  archiveCategoryCore,
  unarchiveCategoryCore,
} from '@/server/actions/categories/core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function cleanupCategoryByName(name: string): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('categories')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .eq('name', name);
}

const NAMES = ['CRUD test cat 1', 'CRUD test cat 2'];

describe('categorias CRUD (integração)', () => {
  afterEach(async () => {
    for (const n of NAMES) await cleanupCategoryByName(n);
  });

  it('I-CAT-CREATE — cria categoria válida com kind especificado', async () => {
    const supabase = await getAuthedClient();
    const result = await createCategoryCore(
      { supabase, session: SEED_SESSION },
      { name: NAMES[0]!, kind: 'income' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category).toMatchObject({
      name: NAMES[0],
      kind: 'income',
      is_archived: false,
    });
  });

  it('I-CAT-CREATE-DUP — nome duplicado no mesmo household → ok:false', async () => {
    const supabase = await getAuthedClient();
    const first = await createCategoryCore(
      { supabase, session: SEED_SESSION },
      { name: NAMES[0]!, kind: 'expense' },
    );
    expect(first.ok).toBe(true);

    const dup = await createCategoryCore(
      { supabase, session: SEED_SESSION },
      { name: NAMES[0]!, kind: 'expense' },
    );
    expect(dup.ok).toBe(false);
  });

  it('I-CAT-ARCHIVE — flipa is_archived true/false (idempotente)', async () => {
    const supabase = await getAuthedClient();
    const created = await createCategoryCore(
      { supabase, session: SEED_SESSION },
      { name: NAMES[0]!, kind: 'expense' },
    );
    if (!created.ok) throw new Error('setup falhou');

    const archived = await archiveCategoryCore(
      { supabase, session: SEED_SESSION },
      { categoryId: created.category.id },
    );
    expect(archived.ok).toBe(true);

    const admin = getAdminClient();
    const { data: row1 } = await admin
      .from('categories')
      .select('is_archived')
      .eq('id', created.category.id)
      .single();
    expect(row1?.is_archived).toBe(true);

    const unarchived = await unarchiveCategoryCore(
      { supabase, session: SEED_SESSION },
      { categoryId: created.category.id },
    );
    expect(unarchived.ok).toBe(true);

    const { data: row2 } = await admin
      .from('categories')
      .select('is_archived')
      .eq('id', created.category.id)
      .single();
    expect(row2?.is_archived).toBe(false);
  });

  it('I-CAT-RENAME — muda name, preserva kind', async () => {
    const supabase = await getAuthedClient();
    const created = await createCategoryCore(
      { supabase, session: SEED_SESSION },
      { name: NAMES[0]!, kind: 'expense' },
    );
    if (!created.ok) throw new Error('setup falhou');

    const renamed = await renameCategoryCore(
      { supabase, session: SEED_SESSION },
      { categoryId: created.category.id, name: NAMES[1]! },
    );
    expect(renamed.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('categories')
      .select('name, kind')
      .eq('id', created.category.id)
      .single();
    expect(data?.name).toBe(NAMES[1]);
    expect(data?.kind).toBe('expense');
  });
});
