import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { buildCoverageTransfers, transactionHasCoverage } from './coverage';
import { toLocalIsoDate } from '@/lib/dates';

const GENERIC = 'Não foi possível atualizar.';
const NOT_FOUND = 'Lançamento não encontrado.';
const INVALID_CATEGORY = 'Categoria inválida.';
const INVALID_ACCOUNT = 'Conta inválida.';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

const patchSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  description: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(200))
    .optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  paid: z.boolean().optional(),
  // Só aplicado quando a transação está fazendo a transição pending → paid.
  // Em qualquer outra mudança de status (paid → pending, ou nenhum patch.paid),
  // o saldo da conta fica intocado por este action.
  updateBalance: z.boolean().optional(),
  date: isoDate.optional(),
});

const inputSchema = z.object({
  id: z.string().uuid(),
  patch: patchSchema,
});

export type UpdateTransactionInput = z.input<typeof inputSchema>;
export type UpdateTransactionResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
  serviceSupabase?: SupabaseClient<Database>;
};

type DbUpdate = Database['public']['Tables']['transactions']['Update'];

function todayServerDate(): string {
  return toLocalIsoDate(new Date());
}

export async function updateTransactionCore(
  { supabase, session, serviceSupabase }: Deps,
  input: UpdateTransactionInput,
): Promise<UpdateTransactionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { id, patch } = parsed.data;

  // Verifica que a transaction existe no household (RLS gateia, mas devolve
  // erro amigável em vez de "row not found").
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, household_id, occurred_on, status, account_id, direction, amount_cents')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const update: DbUpdate = {};

  if (patch.amountCents !== undefined) update.amount_cents = patch.amountCents;
  if (patch.description !== undefined) update.description = patch.description;

  if (patch.categoryId !== undefined) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, household_id')
      .eq('id', patch.categoryId)
      .maybeSingle();
    if (!category || category.household_id !== session.householdId) {
      return { ok: false, error: INVALID_CATEGORY };
    }
    update.category_id = patch.categoryId;
  }

  if (patch.accountId !== undefined) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id, household_id, currency')
      .eq('id', patch.accountId)
      .maybeSingle();
    if (!account || account.household_id !== session.householdId) {
      return { ok: false, error: INVALID_ACCOUNT };
    }
    update.account_id = patch.accountId;
    update.currency = account.currency;
  }

  if (patch.date !== undefined) update.occurred_on = patch.date;

  if (patch.paid !== undefined) {
    if (patch.paid) {
      update.status = 'paid';
      update.paid_on = patch.date ?? existing.occurred_on;
    } else {
      update.status = 'pending';
      update.paid_on = null;
    }
  }

  // TODO(recurring/debt): quando recurring_rules e debts existirem, considerar
  // bloquear edição de transações com source_recurring_rule_id ou source_debt_id
  // setados — ou propagar a mudança pra fonte.

  const wasPaid = existing.status === 'paid';
  const willBePaid = patch.paid === undefined ? wasPaid : patch.paid;
  const finalAccountId = update.account_id ?? existing.account_id;
  const finalAmount = update.amount_cents ?? existing.amount_cents;
  const amountChanged =
    update.amount_cents !== undefined && update.amount_cents !== existing.amount_cents;
  const accountChanged =
    update.account_id !== undefined && update.account_id !== existing.account_id;

  // Despesa paga que gerou cobertura: ao desmarcar, mudar valor ou conta,
  // reverte a cobertura (e o débito da despesa) antes de aplicar a mudança, e
  // recomputa depois se continuar paga. Transações sem cobertura seguem o
  // caminho inline abaixo, preservando o comportamento atual.
  const hasCoverage = wasPaid ? await transactionHasCoverage(supabase, id) : false;
  const recomputeCoverage =
    hasCoverage && (!willBePaid || amountChanged || accountChanged);

  if (recomputeCoverage) {
    const { error: reverseError } = await supabase.rpc('reverse_payment', {
      p_transaction_id: id,
    });
    if (reverseError) return { ok: false, error: GENERIC };
  }

  const { error } = await supabase.from('transactions').update(update).eq('id', id);
  if (error) return { ok: false, error: GENERIC };

  if (recomputeCoverage) {
    if (willBePaid && finalAccountId && existing.direction === 'expense') {
      const paidOn = todayServerDate();
      const transfers = await buildCoverageTransfers(
        { supabase, serviceSupabase },
        { expenseAccountId: finalAccountId, amountCents: finalAmount, fxDate: paidOn },
      );
      const { error: rpcError } = await supabase.rpc('mark_paid_with_coverage', {
        p_transaction_id: id,
        p_paid_on: paidOn,
        p_transfers: transfers,
      });
      if (rpcError) return { ok: false, error: GENERIC };
    }
    return { ok: true };
  }

  const transitionedToPaid = patch.paid === true && existing.status === 'pending';
  if (transitionedToPaid && patch.updateBalance === true) {
    if (finalAccountId) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance_cents')
        .eq('id', finalAccountId)
        .maybeSingle();
      if (acc) {
        const delta = existing.direction === 'income' ? finalAmount : -finalAmount;
        await supabase
          .from('accounts')
          .update({ balance_cents: acc.balance_cents + delta })
          .eq('id', finalAccountId);
      }
    }
  }

  return { ok: true };
}
