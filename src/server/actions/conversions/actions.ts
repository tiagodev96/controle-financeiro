'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import {
  recordConversionCore,
  deleteConversionCore,
  type RecordConversionInput,
  type DeleteConversionInput,
  type RecordConversionResult,
  type ConversionMutationResult,
} from './core';

const EXPIRED = 'Sessão expirada. Entre novamente.';

export async function recordConversionAction(
  input: RecordConversionInput,
): Promise<RecordConversionResult> {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: EXPIRED };
    throw err;
  }

  const supabase = await getServerSupabase();
  const result = await recordConversionCore(
    { supabase, session, serviceSupabase: getServiceRoleSupabase() },
    input,
  );
  if (result.ok) revalidatePath('/');
  return result;
}

export async function deleteConversionAction(
  input: DeleteConversionInput,
): Promise<ConversionMutationResult> {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: EXPIRED };
    throw err;
  }

  const supabase = await getServerSupabase();
  const result = await deleteConversionCore({ supabase, session }, input);
  if (result.ok) revalidatePath('/');
  return result;
}
