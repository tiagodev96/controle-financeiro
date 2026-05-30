import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND_ENVELOPE = 'Caixinha não encontrada.';
const NOT_FOUND_CATEGORY = 'Categoria não encontrada.';

const setReserveSchema = z.object({ envelopeId: z.string().uuid() });
const setEssentialSchema = z.object({
  categoryId: z.string().uuid(),
  isEssential: z.boolean(),
});

export type SetReserveInput = z.input<typeof setReserveSchema>;
export type SetEssentialInput = z.input<typeof setEssentialSchema>;
export type ReservaConfigResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Designa uma caixinha como a reserva rastreada. Como o índice parcial só
 * permite uma is_reserve por household, desmarca a anterior antes de marcar a
 * nova (single-user household, sem transação explícita).
 */
export async function setReserveEnvelopeCore(
  { supabase, session }: Deps,
  input: SetReserveInput,
): Promise<ReservaConfigResult> {
  const parsed = setReserveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('envelopes')
    .select('id, household_id')
    .eq('id', parsed.data.envelopeId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND_ENVELOPE };
  }

  const { error: clearError } = await supabase
    .from('envelopes')
    .update({ is_reserve: false })
    .eq('household_id', session.householdId)
    .eq('is_reserve', true);
  if (clearError) return { ok: false, error: GENERIC };

  const { error } = await supabase
    .from('envelopes')
    .update({ is_reserve: true })
    .eq('id', parsed.data.envelopeId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

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
