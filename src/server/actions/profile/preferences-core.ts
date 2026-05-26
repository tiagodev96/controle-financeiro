import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível salvar preferência.';

const inputSchema = z.object({
  currency: z.enum(['EUR', 'BRL']),
});

export type SetPreferredDisplayCurrencyInput = z.input<typeof inputSchema>;
export type SetPreferredDisplayCurrencyResult =
  | { ok: true }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function setPreferredDisplayCurrencyCore(
  { supabase, session }: Deps,
  input: SetPreferredDisplayCurrencyInput,
): Promise<SetPreferredDisplayCurrencyResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_display_currency: parsed.data.currency })
    .eq('id', session.userId);

  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
