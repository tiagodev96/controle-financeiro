'use server';

import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';

const GENERIC_ERROR = 'Email ou senha inválidos.';

const schema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

type SignInInput = z.input<typeof schema>;

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signInWithEmail(input: SignInInput): Promise<SignInResult> {
  if (process.env.AUTH_ENABLED !== 'true') {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const allowlist = (process.env.AUTH_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.includes(parsed.data.email)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
