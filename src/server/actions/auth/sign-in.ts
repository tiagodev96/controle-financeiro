'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { signInCore, type SignInInput, type SignInResult } from './sign-in-core';

export async function signInWithEmail(input: SignInInput): Promise<SignInResult> {
  const supabase = await getServerSupabase();
  return signInCore({ supabase }, input);
}
