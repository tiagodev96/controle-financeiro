import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { isEmailAllowed, parseAllowlist } from '@/lib/auth/allowlist';

export const GENERIC_SIGN_IN_ERROR = 'Email ou senha inválidos.';

const schema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export type SignInInput = z.input<typeof schema>;
export type SignInResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
};

export async function signInCore(
  { supabase }: Deps,
  input: SignInInput,
): Promise<SignInResult> {
  if (process.env.AUTH_ENABLED !== 'true') {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const allowlist = parseAllowlist(process.env.AUTH_ALLOWED_EMAILS);
  if (!isEmailAllowed(parsed.data.email, allowlist)) {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  return { ok: true };
}
