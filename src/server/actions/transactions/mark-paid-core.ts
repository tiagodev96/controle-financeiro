import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC_ERROR = 'Não foi possível marcar como pago.';
const ALREADY_PAID = 'Transação já está marcada como paga.';

const schema = z.object({
  transactionId: z.string().uuid(),
});

export type MarkPaidInput = z.input<typeof schema>;
export type MarkPaidResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

function todayServerDate(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export async function markPaidCore(
  { supabase, session }: Deps,
  input: MarkPaidInput,
): Promise<MarkPaidResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };

  // Lê pra validar household match + status atual. RLS já bloqueia outro
  // household, mas devolve null em vez de erro — checamos explícito.
  const { data: txn, error: readError } = await supabase
    .from('transactions')
    .select('id, household_id, status')
    .eq('id', parsed.data.transactionId)
    .maybeSingle();

  if (readError || !txn) return { ok: false, error: GENERIC_ERROR };
  if (txn.household_id !== session.householdId) return { ok: false, error: GENERIC_ERROR };
  if (txn.status === 'paid') return { ok: false, error: ALREADY_PAID };

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: 'paid', paid_on: todayServerDate() })
    .eq('id', parsed.data.transactionId);

  if (updateError) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}
