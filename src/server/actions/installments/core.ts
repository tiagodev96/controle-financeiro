import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { splitInstallments, addMonthsClamped } from '@/lib/finance/installments';

type PlanRow = Database['public']['Tables']['installment_plans']['Row'];

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND = 'Plano não encontrado.';
const CURRENCY_MISMATCH = 'Conta em moeda diferente do plano.';
const INVALID_ACCOUNT = 'Conta inválida.';
const INVALID_CATEGORY = 'Categoria inválida.';

const titleSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Título obrigatório').max(80, 'Máximo 80 caracteres'));

const createSchema = z.object({
  title: titleSchema,
  totalAmountCents: z.number().int().positive(),
  currency: z.enum(['EUR', 'BRL']),
  totalInstallments: z.number().int().min(2).max(60),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frequencyMonths: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  notes: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v == null || v.trim() === '' ? null : v.trim().slice(0, 200))),
});

const idSchema = z.object({ planId: z.string().uuid() });

export type CreateInstallmentPlanInput = z.input<typeof createSchema>;
export type DeleteInstallmentPlanInput = z.input<typeof idSchema>;

export type CreateInstallmentPlanResult =
  | { ok: true; plan: PlanRow }
  | { ok: false; error: string };

export type InstallmentPlanMutationResult =
  | { ok: true }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function createInstallmentPlanCore(
  { supabase, session }: Deps,
  input: CreateInstallmentPlanInput,
): Promise<CreateInstallmentPlanResult> {
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
  if (account.currency !== data.currency) {
    return { ok: false, error: CURRENCY_MISMATCH };
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id, household_id')
    .eq('id', data.categoryId)
    .maybeSingle();
  if (!category || category.household_id !== session.householdId) {
    return { ok: false, error: INVALID_CATEGORY };
  }

  const { data: inserted, error } = await supabase
    .from('installment_plans')
    .insert({
      household_id: session.householdId,
      title: data.title,
      total_amount_cents: data.totalAmountCents,
      currency: data.currency,
      total_installments: data.totalInstallments,
      first_due_date: data.firstDueDate,
      frequency_months: data.frequencyMonths,
      category_id: data.categoryId,
      account_id: data.accountId,
      notes: data.notes,
    })
    .select()
    .single();

  if (error || !inserted) return { ok: false, error: GENERIC };

  const amounts = splitInstallments(data.totalAmountCents, data.totalInstallments);
  const rows = amounts.map((amount, idx) => ({
    household_id: session.householdId,
    profile_id: session.userId,
    account_id: data.accountId,
    category_id: data.categoryId,
    direction: 'expense' as const,
    amount_cents: amount,
    currency: data.currency,
    description: `${data.title} ${idx + 1}/${data.totalInstallments}`,
    occurred_on: addMonthsClamped(data.firstDueDate, idx * data.frequencyMonths),
    paid_on: null,
    status: 'pending' as const,
    source_installment_plan_id: inserted.id,
    installment_number: idx + 1,
  }));

  const { error: txnError } = await supabase.from('transactions').insert(rows);
  if (txnError) {
    // Rollback manual: remove o plano órfão.
    await supabase.from('installment_plans').delete().eq('id', inserted.id);
    return { ok: false, error: GENERIC };
  }

  return { ok: true, plan: inserted };
}

export async function deleteInstallmentPlanCore(
  { supabase, session }: Deps,
  input: DeleteInstallmentPlanInput,
): Promise<InstallmentPlanMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('installment_plans')
    .select('id, household_id')
    .eq('id', parsed.data.planId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await supabase
    .from('installment_plans')
    .delete()
    .eq('id', parsed.data.planId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
