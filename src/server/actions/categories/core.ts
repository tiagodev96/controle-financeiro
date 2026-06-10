import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type CategoryRow = Database['public']['Tables']['categories']['Row'];

const GENERIC = 'Não foi possível salvar.';
const DUPLICATE = 'Já existe uma categoria com esse nome.';
const NOT_FOUND = 'Categoria não encontrada.';
const PROTECTED = '"Outros" é a categoria de backup e não pode ser alterada.';

const PROTECTED_NAME = 'Outros';

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Nome obrigatório').max(50, 'Máximo 50 caracteres'));

const iconSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v == null || v === '' ? null : v));

const monthlyLimitSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional()
  .transform((v) => (v == null || v === 0 ? null : v));

const limitCurrencySchema = z.enum(['EUR', 'BRL']).nullable().optional();

const createSchema = z.object({
  name: nameSchema,
  kind: z.enum(['expense', 'income']),
  icon: iconSchema,
  monthlyLimitCents: monthlyLimitSchema,
  limitCurrency: limitCurrencySchema,
});

const renameSchema = z.object({
  categoryId: z.string().uuid(),
  name: nameSchema,
});

const updateSchema = z.object({
  categoryId: z.string().uuid(),
  patch: z.object({
    name: nameSchema.optional(),
    icon: iconSchema,
    monthlyLimitCents: monthlyLimitSchema,
    limitCurrency: limitCurrencySchema,
  }),
});

const idSchema = z.object({ categoryId: z.string().uuid() });

export type CreateCategoryInput = z.input<typeof createSchema>;
export type RenameCategoryInput = z.input<typeof renameSchema>;
export type UpdateCategoryInput = z.input<typeof updateSchema>;
export type CategoryActionInput = z.input<typeof idSchema>;

export type CreateCategoryResult =
  | { ok: true; category: CategoryRow }
  | { ok: false; error: string };

export type CategoryMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

function isDuplicateError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '23505' || (err.message?.includes('duplicate') ?? false);
}

export async function createCategoryCore(
  { supabase, session }: Deps,
  input: CreateCategoryInput,
): Promise<CreateCategoryResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }

  const hasLimit = parsed.data.monthlyLimitCents != null && parsed.data.monthlyLimitCents > 0;
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: session.householdId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      icon: parsed.data.icon ?? null,
      monthly_limit_cents: hasLimit ? parsed.data.monthlyLimitCents : null,
      limit_currency: hasLimit ? (parsed.data.limitCurrency ?? 'EUR') : null,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: isDuplicateError(error) ? DUPLICATE : GENERIC };
  }
  if (!data) return { ok: false, error: GENERIC };
  return { ok: true, category: data };
}

export async function renameCategoryCore(
  { supabase, session }: Deps,
  input: RenameCategoryInput,
): Promise<CategoryMutationResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }

  const { data: existing, error: readErr } = await supabase
    .from('categories')
    .select('id, household_id, name')
    .eq('id', parsed.data.categoryId)
    .maybeSingle();
  if (readErr || !existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  if (existing.name === PROTECTED_NAME) {
    return { ok: false, error: PROTECTED };
  }

  const { error: updErr } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.categoryId);

  if (updErr) {
    return { ok: false, error: isDuplicateError(updErr) ? DUPLICATE : GENERIC };
  }
  return { ok: true };
}

export async function updateCategoryCore(
  { supabase, session }: Deps,
  input: UpdateCategoryInput,
): Promise<CategoryMutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const { categoryId, patch } = parsed.data;

  const { data: existing } = await supabase
    .from('categories')
    .select('id, household_id, name')
    .eq('id', categoryId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  // Outros pode trocar ícone, só não pode ser renomeada.
  if (existing.name === PROTECTED_NAME && patch.name !== undefined && patch.name !== existing.name) {
    return { ok: false, error: PROTECTED };
  }

  const update: Database['public']['Tables']['categories']['Update'] = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.monthlyLimitCents !== undefined) {
    update.monthly_limit_cents = patch.monthlyLimitCents;
    // Limpa currency junto quando o limite vira null. Quando setando limite,
    // o caller é responsável por mandar limitCurrency junto.
    if (patch.monthlyLimitCents === null) update.limit_currency = null;
  }
  if (patch.limitCurrency !== undefined) update.limit_currency = patch.limitCurrency;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error: updErr } = await supabase
    .from('categories')
    .update(update)
    .eq('id', categoryId);
  if (updErr) {
    return { ok: false, error: isDuplicateError(updErr) ? DUPLICATE : GENERIC };
  }
  return { ok: true };
}

export async function deleteCategoryCore(
  { supabase, session }: Deps,
  input: CategoryActionInput,
): Promise<CategoryMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('categories')
    .select('id, household_id, name, kind')
    .eq('id', parsed.data.categoryId)
    .maybeSingle();
  if (!existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  if (existing.name === PROTECTED_NAME) {
    return { ok: false, error: PROTECTED };
  }

  // Procura "Outros" da mesma kind pra herdar os lançamentos órfãos.
  // Se não existir, deixa o ON DELETE SET NULL fazer o trabalho (orfana).
  const { data: backup } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', session.householdId)
    .eq('name', PROTECTED_NAME)
    .eq('kind', existing.kind)
    .maybeSingle();

  if (backup) {
    // Reassign em paralelo. ON DELETE SET NULL cuida do resto se algum falhar
    // — mas falha não pode ser invisível.
    const reassigns = await Promise.all([
      supabase
        .from('transactions')
        .update({ category_id: backup.id })
        .eq('category_id', parsed.data.categoryId),
      supabase
        .from('recurring_rules')
        .update({ category_id: backup.id })
        .eq('category_id', parsed.data.categoryId),
      supabase
        .from('installment_plans')
        .update({ category_id: backup.id })
        .eq('category_id', parsed.data.categoryId),
    ]);
    for (const { error: reassignError } of reassigns) {
      if (reassignError) {
        console.error(
          `categories: reassign pra "${PROTECTED_NAME}" falhou (vão orfanar): ${reassignError.message}`,
        );
      }
    }
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', parsed.data.categoryId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

async function setArchived(
  deps: Deps,
  input: CategoryActionInput,
  value: boolean,
): Promise<CategoryMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await deps.supabase
    .from('categories')
    .select('id, household_id')
    .eq('id', parsed.data.categoryId)
    .maybeSingle();
  if (!existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== deps.session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await deps.supabase
    .from('categories')
    .update({ is_archived: value })
    .eq('id', parsed.data.categoryId);

  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

export function archiveCategoryCore(
  deps: Deps,
  input: CategoryActionInput,
): Promise<CategoryMutationResult> {
  return setArchived(deps, input, true);
}

export function unarchiveCategoryCore(
  deps: Deps,
  input: CategoryActionInput,
): Promise<CategoryMutationResult> {
  return setArchived(deps, input, false);
}
