'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import type { CreateTransactionInput } from '@/lib/transactions/schema';
import {
  createTransactionForSession,
  type CreateTransactionResult,
} from './create-core';

const LAST_ACCOUNT_COOKIE = 'cf_last_account_id';
const COOKIE_MAX_AGE_DAYS = 365;

export async function createTransaction(
  input: CreateTransactionInput
): Promise<CreateTransactionResult> {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return { ok: false, error: 'Sessão expirada. Entre novamente.' };
    }
    throw err;
  }

  const supabase = await getServerSupabase();
  const result = await createTransactionForSession({ supabase, session }, input);

  if (result.ok) {
    const cookieStore = await cookies();
    cookieStore.set(LAST_ACCOUNT_COOKIE, input.accountId, {
      path: '/',
      maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
      sameSite: 'lax',
    });
    revalidatePath('/');
    revalidatePath('/transacoes');
  }

  return result;
}
