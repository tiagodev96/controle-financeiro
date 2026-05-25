import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type RecurringRow = Database['public']['Tables']['recurring_rules']['Row'];

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND = 'Regra não encontrada.';
const INVALID_CATEGORY = 'Categoria inválida.';
const INVALID_ACCOUNT = 'Conta inválida.';

const titleSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Título obrigatório').max(50, 'Máximo 50 caracteres'));

const notesSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v == null || v.trim() === '' ? null : v.trim().slice(0, 200)));

const createSchema = z.object({
  title: titleSchema,
  amountCents: z.number().int().positive(),
  direction: z.enum(['expense', 'income']),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  dayOfMonth: z.number().int().min(1).max(28),
  notes: notesSchema,
});

const updateSchema = z.object({
  ruleId: z.string().uuid(),
  patch: z.object({
    title: titleSchema.optional(),
    amountCents: z.number().int().positive().optional(),
    categoryId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    notes: notesSchema,
  }),
});

const idSchema = z.object({ ruleId: z.string().uuid() });

export type CreateRecurringInput = z.input<typeof createSchema>;
export type UpdateRecurringInput = z.input<typeof updateSchema>;
export type RecurringActionInput = z.input<typeof idSchema>;

export type CreateRecurringResult =
  | { ok: true; rule: RecurringRow }
  | { ok: false; error: string };
export type RecurringMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function createRecurringCore(
  { supabase, session }: Deps,
  input: CreateRecurringInput,
): Promise<CreateRecurringResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: account } = await supabase
    .from('accounts')
    .select('id, household_id, currency')
    .eq('id', data.accountId)
    .maybeSingle();
  if (!account || account.household_id !== session.householdId) {
    return { ok: false, error: INVALID_ACCOUNT };
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id, household_id, kind')
    .eq('id', data.categoryId)
    .maybeSingle();
  if (!category || category.household_id !== session.householdId) {
    return { ok: false, error: INVALID_CATEGORY };
  }

  const { data: inserted, error } = await supabase
    .from('recurring_rules')
    .insert({
      household_id: session.householdId,
      title: data.title,
      amount_cents: data.amountCents,
      direction: data.direction,
      currency: account.currency,
      category_id: data.categoryId,
      account_id: data.accountId,
      day_of_month: data.dayOfMonth,
      frequency: 'monthly',
      notes: data.notes,
    })
    .select()
    .single();

  if (error || !inserted) return { ok: false, error: GENERIC };
  return { ok: true, rule: inserted };
}

export async function updateRecurringCore(
  { supabase, session }: Deps,
  input: UpdateRecurringInput,
): Promise<RecurringMutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { ruleId, patch } = parsed.data;

  const { data: existing } = await supabase
    .from('recurring_rules')
    .select('id, household_id')
    .eq('id', ruleId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const update: Database['public']['Tables']['recurring_rules']['Update'] = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.amountCents !== undefined) update.amount_cents = patch.amountCents;
  if (patch.dayOfMonth !== undefined) update.day_of_month = patch.dayOfMonth;
  if (patch.notes !== undefined) update.notes = patch.notes;

  if (patch.categoryId !== undefined) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id, household_id')
      .eq('id', patch.categoryId)
      .maybeSingle();
    if (!cat || cat.household_id !== session.householdId) {
      return { ok: false, error: INVALID_CATEGORY };
    }
    update.category_id = patch.categoryId;
  }

  if (patch.accountId !== undefined) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('id, household_id, currency')
      .eq('id', patch.accountId)
      .maybeSingle();
    if (!acc || acc.household_id !== session.householdId) {
      return { ok: false, error: INVALID_ACCOUNT };
    }
    update.account_id = patch.accountId;
    update.currency = acc.currency;
  }

  const { error } = await supabase
    .from('recurring_rules')
    .update(update)
    .eq('id', ruleId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

async function setPaused(
  deps: Deps,
  input: RecurringActionInput,
  value: boolean,
): Promise<RecurringMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await deps.supabase
    .from('recurring_rules')
    .select('id, household_id')
    .eq('id', parsed.data.ruleId)
    .maybeSingle();
  if (!existing || existing.household_id !== deps.session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await deps.supabase
    .from('recurring_rules')
    .update({ is_paused: value })
    .eq('id', parsed.data.ruleId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

export function pauseRecurringCore(
  deps: Deps,
  input: RecurringActionInput,
): Promise<RecurringMutationResult> {
  return setPaused(deps, input, true);
}

export function resumeRecurringCore(
  deps: Deps,
  input: RecurringActionInput,
): Promise<RecurringMutationResult> {
  return setPaused(deps, input, false);
}

export async function deleteRecurringCore(
  { supabase, session }: Deps,
  input: RecurringActionInput,
): Promise<RecurringMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('recurring_rules')
    .select('id, household_id')
    .eq('id', parsed.data.ruleId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await supabase
    .from('recurring_rules')
    .delete()
    .eq('id', parsed.data.ruleId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
