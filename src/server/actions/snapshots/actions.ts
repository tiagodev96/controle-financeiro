'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  deleteSnapshotCore,
  setSnapshotCore,
  type DeleteSnapshotInput,
  type SetSnapshotInput,
  type SnapshotMutationResult,
} from './core';

function revalidateAll(): void {
  revalidatePath('/contas');
  revalidatePath('/resumo');
  revalidatePath('/');
}

export async function setSnapshotAction(
  input: SetSnapshotInput,
): Promise<SnapshotMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await setSnapshotCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteSnapshotAction(
  input: DeleteSnapshotInput,
): Promise<SnapshotMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteSnapshotCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
