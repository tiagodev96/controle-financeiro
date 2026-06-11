import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { monthIso, monthRange } from '@/lib/dates';

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

const frequencySchema = z.enum(['monthly', 'yearly']);

const createSchema = z.object({
  title: titleSchema,
  amountCents: z.number().int().positive(),
  direction: z.enum(['expense', 'income']),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  dayOfMonth: z.number().int().min(1).max(28),
  frequency: frequencySchema.default('monthly'),
  /**
   * Mês-aniversário da regra anual (YYYY-MM). Vira active_from = dia 1 do
   * mês. Ignorado pra mensal.
   */
  anniversaryMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
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
    frequency: frequencySchema.optional(),
    anniversaryMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
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
      frequency: data.frequency,
      // Anual: active_from define o mês-aniversário da geração.
      ...(data.frequency === 'yearly' && data.anniversaryMonth
        ? { active_from: `${data.anniversaryMonth}-01` }
        : {}),
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
  if (patch.frequency !== undefined) update.frequency = patch.frequency;
  if (patch.anniversaryMonth !== undefined) update.active_from = `${patch.anniversaryMonth}-01`;
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

  await syncCurrentMonthPendingWithRule(supabase, ruleId);
  return { ok: true };
}

/**
 * Espelha a regra na transaction PENDENTE já gerada no mês corrente — quem
 * edita valor/dia/conta da regra espera ver o lançamento do mês acompanhar.
 * Pagas e meses anteriores ficam intocados. Best-effort: falha aqui não
 * desfaz a edição da regra, só loga.
 */
async function syncCurrentMonthPendingWithRule(
  supabase: SupabaseClient<Database>,
  ruleId: string,
): Promise<void> {
  const { data: rule, error: ruleError } = await supabase
    .from('recurring_rules')
    .select('title, amount_cents, currency, category_id, account_id, day_of_month')
    .eq('id', ruleId)
    .maybeSingle();
  if (ruleError || !rule) {
    if (ruleError) console.error(`recurring sync: leitura da regra falhou: ${ruleError.message}`);
    return;
  }

  const now = new Date();
  const { start, end } = monthRange(now);
  const occurredOn = `${monthIso(now)}-${String(rule.day_of_month).padStart(2, '0')}`;

  const { error: syncError } = await supabase
    .from('transactions')
    .update({
      amount_cents: rule.amount_cents,
      currency: rule.currency,
      category_id: rule.category_id,
      account_id: rule.account_id ?? undefined,
      description: rule.title,
      occurred_on: occurredOn,
    })
    .eq('source_recurring_rule_id', ruleId)
    .eq('status', 'pending')
    .gte('occurred_on', start)
    .lt('occurred_on', end);

  if (syncError) {
    console.error(`recurring sync: pendente do mês não atualizada: ${syncError.message}`);
  }
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
