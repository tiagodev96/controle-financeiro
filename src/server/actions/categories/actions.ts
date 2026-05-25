'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  archiveCategoryCore,
  createCategoryCore,
  renameCategoryCore,
  unarchiveCategoryCore,
  type CategoryActionInput,
  type CategoryMutationResult,
  type CreateCategoryInput,
  type CreateCategoryResult,
  type RenameCategoryInput,
} from './core';

function revalidateAll(): void {
  revalidatePath('/categorias');
  revalidatePath('/lancar');
  revalidatePath('/transacoes');
}

export async function createCategoryAction(
  input: CreateCategoryInput,
): Promise<CreateCategoryResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createCategoryCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function renameCategoryAction(
  input: RenameCategoryInput,
): Promise<CategoryMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await renameCategoryCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function archiveCategoryAction(
  input: CategoryActionInput,
): Promise<CategoryMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await archiveCategoryCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function unarchiveCategoryAction(
  input: CategoryActionInput,
): Promise<CategoryMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await unarchiveCategoryCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
