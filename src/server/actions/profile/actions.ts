'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  setPreferredDisplayCurrencyCore,
  type SetPreferredDisplayCurrencyInput,
  type SetPreferredDisplayCurrencyResult,
} from './preferences-core';

export async function setPreferredDisplayCurrencyAction(
  input: SetPreferredDisplayCurrencyInput,
): Promise<SetPreferredDisplayCurrencyResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await setPreferredDisplayCurrencyCore({ supabase, session }, input);
  if (result.ok) {
    revalidatePath('/', 'layout');
  }
  return result;
}
