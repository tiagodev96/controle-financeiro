import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import type { ParsedStatement } from '@/lib/finance/btg-statement';

const GENERIC = 'Não foi possível importar a fatura.';
const INVALID_CARD = 'Cartão inválido.';
const INVALID_CATEGORY = 'Categoria inválida.';
const NOT_BRL = 'A fatura importada é em BRL — a conta de pagamento deste cartão precisa ser BRL.';

const purchaseSchema = z.object({
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive(),
  externalRef: z.string().min(1).max(40),
  kind: z.enum(['avista', 'internacional', 'parcela']),
  cardLast4: z.string().nullable(),
});

const statementSchema = z.object({
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthLabel: z.string(),
  purchases: z.array(purchaseSchema).min(1, 'A fatura não tem compras importáveis.').max(500),
  ignoredCount: z.number().int().min(0),
  statementTotalCents: z.number().int().nullable(),
});

const importSchema = z.object({
  cardId: z.string().uuid(),
  statement: statementSchema,
  categoryId: z.string().uuid().nullable().optional(),
  dryRun: z.boolean().default(false),
});

export type ImportCardStatementInput = z.input<typeof importSchema>;

export type ImportCardStatementResult =
  | {
      ok: true;
      imported: number;
      skippedExisting: number;
      ignoredCount: number;
      importedCents: number;
      statementTotalCents: number | null;
      dueOn: string;
      monthLabel: string;
      dryRun: boolean;
    }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Importa as compras de uma fatura já parseada. occurred_on = vencimento LIDO
 * do arquivo (o banco inclui compras postadas fora do período — não recalcular
 * pelo ciclo). Idempotente em duas camadas: filtro por external_ref/duplicata
 * manual aqui, índice único (credit_card_id, external_ref) no banco.
 */
export async function importCardStatementCore(
  { supabase, session }: Deps,
  input: ImportCardStatementInput,
): Promise<ImportCardStatementResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const { cardId, statement, categoryId, dryRun } = parsed.data;

  const { data: card } = await supabase
    .from('credit_cards')
    .select('id, household_id, payment_account_id, is_archived')
    .eq('id', cardId)
    .maybeSingle();
  if (!card || card.household_id !== session.householdId || card.is_archived) {
    return { ok: false, error: INVALID_CARD };
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, currency')
    .eq('id', card.payment_account_id)
    .maybeSingle();
  if (!account) return { ok: false, error: INVALID_CARD };
  if (account.currency !== 'BRL') return { ok: false, error: NOT_BRL };

  if (categoryId) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, household_id')
      .eq('id', categoryId)
      .maybeSingle();
    if (!category || category.household_id !== session.householdId) {
      return { ok: false, error: INVALID_CATEGORY };
    }
  }

  // Dedupe 1: compras já importadas (external_ref do arquivo).
  const refs = statement.purchases.map((p) => p.externalRef);
  const { data: existingByRef, error: refError } = await supabase
    .from('transactions')
    .select('external_ref')
    .eq('credit_card_id', cardId)
    .in('external_ref', refs);
  if (refError) return { ok: false, error: GENERIC };
  const knownRefs = new Set((existingByRef ?? []).map((t) => t.external_ref));

  // Dedupe 2: compra lançada à mão no cartão (sem ref) com mesma data e valor.
  const dates = Array.from(new Set(statement.purchases.map((p) => p.purchasedOn)));
  const { data: manual, error: manualError } = await supabase
    .from('transactions')
    .select('purchased_on, amount_cents')
    .eq('credit_card_id', cardId)
    .is('external_ref', null)
    .in('purchased_on', dates);
  if (manualError) return { ok: false, error: GENERIC };
  const manualKeys = new Set((manual ?? []).map((t) => `${t.purchased_on}:${t.amount_cents}`));

  const toImport = statement.purchases.filter(
    (p) => !knownRefs.has(p.externalRef) && !manualKeys.has(`${p.purchasedOn}:${p.amountCents}`),
  );
  const skippedExisting = statement.purchases.length - toImport.length;
  const importedCents = toImport.reduce((sum, p) => sum + p.amountCents, 0);

  if (!dryRun && toImport.length > 0) {
    const rows = toImport.map((p) => ({
      household_id: session.householdId,
      profile_id: session.userId,
      account_id: card.payment_account_id,
      category_id: categoryId ?? null,
      direction: 'expense' as const,
      amount_cents: p.amountCents,
      currency: 'BRL' as const,
      description: p.description,
      occurred_on: statement.dueOn,
      paid_on: null,
      status: 'pending' as const,
      credit_card_id: cardId,
      purchased_on: p.purchasedOn,
      external_ref: p.externalRef,
    }));
    const { error: insertError } = await supabase.from('transactions').insert(rows);
    if (insertError) {
      // 23505 = corrida com outro import simultâneo; o índice único segurou.
      if (insertError.code === '23505') {
        return { ok: false, error: 'Importação concorrente detectada — recarregue e tente de novo.' };
      }
      return { ok: false, error: GENERIC };
    }
  }

  return {
    ok: true,
    imported: toImport.length,
    skippedExisting,
    ignoredCount: statement.ignoredCount,
    importedCents,
    statementTotalCents: statement.statementTotalCents,
    dueOn: statement.dueOn,
    monthLabel: statement.monthLabel,
    dryRun,
  };
}
