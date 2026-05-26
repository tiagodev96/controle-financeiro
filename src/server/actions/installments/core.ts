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

const updateSchema = z.object({
  planId: z.string().uuid(),
  title: titleSchema.optional(),
  notes: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v == null || (typeof v === 'string' && v.trim() === '') ? null : v.trim().slice(0, 200))),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  totalAmountCents: z.number().int().positive().optional(),
  totalInstallments: z.number().int().min(2).max(60).optional(),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  frequencyMonths: z.number().int().min(1).max(12).optional(),
});

const STRUCT_KEYS = ['totalAmountCents', 'totalInstallments', 'firstDueDate', 'frequencyMonths'] as const;

const PAID_GREATER_THAN_NEW_N = 'Novo número de parcelas é menor que o já pago.';
const TOTAL_LESS_THAN_PAID = 'Novo valor total é menor que a soma já paga.';

export type CreateInstallmentPlanInput = z.input<typeof createSchema>;
export type DeleteInstallmentPlanInput = z.input<typeof idSchema>;
export type UpdateInstallmentPlanInput = z.input<typeof updateSchema>;

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

export async function updateInstallmentPlanCore(
  { supabase, session }: Deps,
  input: UpdateInstallmentPlanInput,
): Promise<InstallmentPlanMutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: existing } = await supabase
    .from('installment_plans')
    .select('id, household_id, currency, total_amount_cents, total_installments, first_due_date, frequency_months, category_id, account_id')
    .eq('id', data.planId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  if (data.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id, household_id')
      .eq('id', data.categoryId)
      .maybeSingle();
    if (!cat || cat.household_id !== session.householdId) {
      return { ok: false, error: INVALID_CATEGORY };
    }
  }

  if (data.accountId) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('id, household_id, currency')
      .eq('id', data.accountId)
      .maybeSingle();
    if (!acc || acc.household_id !== session.householdId) {
      return { ok: false, error: INVALID_ACCOUNT };
    }
    if (acc.currency !== existing.currency) {
      return { ok: false, error: CURRENCY_MISMATCH };
    }
  }

  const structChanged = STRUCT_KEYS.some((k) => data[k] !== undefined);

  // Se mexeu em estrutura, valida + recomputa parcelas pendentes.
  if (structChanged) {
    const { data: paidTxns } = await supabase
      .from('transactions')
      .select('amount_cents, installment_number')
      .eq('source_installment_plan_id', data.planId)
      .eq('status', 'paid');
    const paidCount = paidTxns?.length ?? 0;
    const paidSum = (paidTxns ?? []).reduce((s, t) => s + t.amount_cents, 0);

    const newTotal = data.totalAmountCents ?? existing.total_amount_cents;
    const newN = data.totalInstallments ?? existing.total_installments;
    const newFirstDue = data.firstDueDate ?? existing.first_due_date;
    const newFreq = data.frequencyMonths ?? existing.frequency_months;

    if (newN <= paidCount && paidCount > 0) {
      return { ok: false, error: PAID_GREATER_THAN_NEW_N };
    }
    if (newTotal < paidSum) {
      return { ok: false, error: TOTAL_LESS_THAN_PAID };
    }

    // Apaga pendentes existentes — vão ser recriadas com novo cronograma.
    const { error: delError } = await supabase
      .from('transactions')
      .delete()
      .eq('source_installment_plan_id', data.planId)
      .eq('status', 'pending');
    if (delError) return { ok: false, error: GENERIC };

    const pendingCount = newN - paidCount;
    if (pendingCount > 0) {
      const remainingCents = newTotal - paidSum;
      const amounts = splitInstallments(remainingCents, pendingCount);
      const accountForGen = data.accountId ?? existing.account_id;
      const categoryForGen = data.categoryId ?? existing.category_id;
      if (!accountForGen || !categoryForGen) {
        return { ok: false, error: GENERIC };
      }
      const titleForGen = data.title ?? '';
      // Pega title atual do plano se não veio no input
      let resolvedTitle = titleForGen;
      if (!resolvedTitle) {
        const { data: planTitleRow } = await supabase
          .from('installment_plans')
          .select('title')
          .eq('id', data.planId)
          .maybeSingle();
        resolvedTitle = planTitleRow?.title ?? '';
      }
      const rows = amounts.map((amount, idx) => {
        const installmentNumber = paidCount + idx + 1;
        return {
          household_id: session.householdId,
          profile_id: session.userId,
          account_id: accountForGen,
          category_id: categoryForGen,
          direction: 'expense' as const,
          amount_cents: amount,
          currency: existing.currency,
          description: `${resolvedTitle} ${installmentNumber}/${newN}`,
          occurred_on: addMonthsClamped(newFirstDue, idx * newFreq),
          paid_on: null,
          status: 'pending' as const,
          source_installment_plan_id: data.planId,
          installment_number: installmentNumber,
        };
      });
      const { error: insError } = await supabase.from('transactions').insert(rows);
      if (insError) return { ok: false, error: GENERIC };
    }
  }

  const planUpdate: Database['public']['Tables']['installment_plans']['Update'] = {};
  if (data.title !== undefined) planUpdate.title = data.title;
  if ('notes' in data) planUpdate.notes = data.notes;
  if (data.categoryId !== undefined) planUpdate.category_id = data.categoryId;
  if (data.accountId !== undefined) planUpdate.account_id = data.accountId;
  if (data.totalAmountCents !== undefined) planUpdate.total_amount_cents = data.totalAmountCents;
  if (data.totalInstallments !== undefined) planUpdate.total_installments = data.totalInstallments;
  if (data.firstDueDate !== undefined) planUpdate.first_due_date = data.firstDueDate;
  if (data.frequencyMonths !== undefined) planUpdate.frequency_months = data.frequencyMonths;

  if (Object.keys(planUpdate).length > 0) {
    const { error } = await supabase
      .from('installment_plans')
      .update(planUpdate)
      .eq('id', data.planId);
    if (error) return { ok: false, error: GENERIC };
  }

  // Propaga category/account pra paid também (decisão de produto: opção 2 anterior).
  // Pendentes recém-criadas já vieram com os novos valores acima.
  const txnUpdate: Database['public']['Tables']['transactions']['Update'] = {};
  if (data.categoryId !== undefined) txnUpdate.category_id = data.categoryId;
  if (data.accountId !== undefined) txnUpdate.account_id = data.accountId;
  if (Object.keys(txnUpdate).length > 0) {
    const { error } = await supabase
      .from('transactions')
      .update(txnUpdate)
      .eq('source_installment_plan_id', data.planId);
    if (error) return { ok: false, error: GENERIC };
  }

  // Se o título mudou, atualiza descrição das paid ("Notebook 1/3" → "Notebook v2 1/3")
  if (data.title !== undefined) {
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('id, installment_number')
      .eq('source_installment_plan_id', data.planId);
    const newN = data.totalInstallments ?? existing.total_installments;
    for (const t of allTxns ?? []) {
      if (t.installment_number == null) continue;
      await supabase
        .from('transactions')
        .update({ description: `${data.title} ${t.installment_number}/${newN}` })
        .eq('id', t.id);
    }
  }

  return { ok: true };
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
