import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível pagar a fatura.';
const INVALID_CARD = 'Cartão inválido.';

const paySchema = z.object({
  cardId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Conta debitada; default é a conta de pagamento do cartão. */
  accountId: z.string().uuid().optional(),
  updateBalance: z.boolean().default(true),
});

export type PayCardInvoiceInput = z.input<typeof paySchema>;

export type PayCardInvoiceResult =
  | { ok: true; totalPaidCents: number }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Paga a fatura de um vencimento via RPC: marca as compras pendentes como
 * pagas e debita a conta UMA vez pelo total, atômico. Idempotente — segunda
 * chamada retorna 0.
 */
export async function payCardInvoiceCore(
  { supabase, session }: Deps,
  input: PayCardInvoiceInput,
): Promise<PayCardInvoiceResult> {
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: card } = await supabase
    .from('credit_cards')
    .select('id, household_id, payment_account_id')
    .eq('id', data.cardId)
    .maybeSingle();
  if (!card || card.household_id !== session.householdId) {
    return { ok: false, error: INVALID_CARD };
  }

  const { data: total, error } = await supabase.rpc('pay_credit_card_invoice', {
    p_card_id: card.id,
    p_due_date: data.dueDate,
    p_paid_on: data.paidOn,
    p_account_id: data.accountId ?? card.payment_account_id,
    p_update_balance: data.updateBalance,
  });

  if (error || typeof total !== 'number') {
    return { ok: false, error: error?.message ?? GENERIC };
  }
  return { ok: true, totalPaidCents: total };
}
