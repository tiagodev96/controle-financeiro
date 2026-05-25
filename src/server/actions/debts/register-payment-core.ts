import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível registrar pagamento.';
const NOT_FOUND = 'Dívida não encontrada.';
const CURRENCY_MISMATCH = 'Conta em moeda diferente da dívida.';
const INVALID_ACCOUNT = 'Conta inválida.';
const DEBT_CLOSED = 'Dívida já está fechada.';

const inputSchema = z.object({
  debtId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  accountId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(200)),
});

export type RegisterDebtPaymentInput = z.input<typeof inputSchema>;
export type RegisterDebtPaymentResult =
  | { ok: true; closedDebt: boolean }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function registerDebtPaymentCore(
  { supabase, session }: Deps,
  input: RegisterDebtPaymentInput,
): Promise<RegisterDebtPaymentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const data = parsed.data;

  // Lê a dívida pra validar household + currency + status
  const { data: debt } = await supabase
    .from('debts')
    .select('id, household_id, currency, status, remaining_amount_cents, title')
    .eq('id', data.debtId)
    .maybeSingle();
  if (!debt || debt.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  if (debt.status === 'closed') {
    return { ok: false, error: DEBT_CLOSED };
  }

  // Lê a conta pra validar household + currency
  const { data: account } = await supabase
    .from('accounts')
    .select('id, household_id, currency')
    .eq('id', data.accountId)
    .maybeSingle();
  if (!account || account.household_id !== session.householdId) {
    return { ok: false, error: INVALID_ACCOUNT };
  }
  if (account.currency !== debt.currency) {
    return { ok: false, error: CURRENCY_MISMATCH };
  }

  const { error } = await supabase.from('transactions').insert({
    household_id: session.householdId,
    profile_id: session.userId,
    account_id: data.accountId,
    category_id: null,
    direction: 'expense',
    amount_cents: data.amountCents,
    currency: account.currency,
    description: data.description,
    occurred_on: data.date,
    paid_on: data.date,
    status: 'paid',
    source_debt_id: data.debtId,
  });

  if (error) return { ok: false, error: GENERIC };

  // Re-lê a dívida pra saber se o trigger fechou
  const { data: after } = await supabase
    .from('debts')
    .select('status')
    .eq('id', data.debtId)
    .maybeSingle();

  return { ok: true, closedDebt: after?.status === 'closed' };
}
