import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível remover.';
const NOT_FOUND = 'Lançamento não encontrado.';

const inputSchema = z.object({ id: z.string().uuid() });

export type DeleteTransactionInput = z.input<typeof inputSchema>;
export type DeleteTransactionResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function deleteTransactionCore(
  { supabase, session }: Deps,
  input: DeleteTransactionInput,
): Promise<DeleteTransactionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  // Lê pra validar household match (RLS bloqueia silenciosamente —
  // queremos devolver erro amigável).
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, household_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  // TODO(recurring/debt): quando existir, considerar bloquear delete de
  // transação com source_* não-null OU propagar pra fonte.

  const { error } = await supabase.from('transactions').delete().eq('id', parsed.data.id);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
