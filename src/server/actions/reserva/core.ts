import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND_CATEGORY = 'Categoria não encontrada.';

const setEssentialSchema = z.object({
  categoryId: z.string().uuid(),
  isEssential: z.boolean(),
});

export type SetEssentialInput = z.input<typeof setEssentialSchema>;
export type ReservaConfigResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function setCategoryEssentialCore(
  { supabase, session }: Deps,
  input: SetEssentialInput,
): Promise<ReservaConfigResult> {
  const parsed = setEssentialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('categories')
    .select('id, household_id')
    .eq('id', parsed.data.categoryId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND_CATEGORY };
  }

  const { error } = await supabase
    .from('categories')
    .update({ is_essential: parsed.data.isEssential })
    .eq('id', parsed.data.categoryId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
