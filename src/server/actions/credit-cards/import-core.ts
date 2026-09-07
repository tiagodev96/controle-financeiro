import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import type { ParsedPurchase, ParsedStatement } from '@/lib/finance/btg-statement';
import { addMonthsClamped } from '@/lib/finance/installments';

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
  installment: z
    .object({ number: z.number().int().min(1), total: z.number().int().min(1).max(60) })
    .nullable(),
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
      /** Parcelas futuras (n+1..m) projetadas nas faturas seguintes. */
      importedFuture: number;
      futureCents: number;
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
 * pelo ciclo). Parcela n/m também projeta as futuras (n+1..m) nas faturas
 * seguintes, com mesmo valor e ref auth#k/m — quando a fatura real do mês
 * seguinte chegar, essas linhas já existem e são puladas. Idempotente em duas
 * camadas: filtro por external_ref/duplicata manual aqui, índice único
 * (credit_card_id, external_ref) no banco.
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

  // Parcelas futuras derivadas das parcelas do arquivo: mesma compra, valor
  // igual (BTG "sem juros"), vencendo nas faturas seguintes.
  type FuturePurchase = Pick<ParsedPurchase, 'purchasedOn' | 'description' | 'amountCents' | 'externalRef'> & {
    occurredOn: string;
  };
  const futures: FuturePurchase[] = [];
  for (const p of statement.purchases) {
    if (!p.installment || p.installment.number >= p.installment.total) continue;
    const auth = p.externalRef.split('#')[0]!;
    for (let k = p.installment.number + 1; k <= p.installment.total; k++) {
      futures.push({
        purchasedOn: p.purchasedOn,
        description: p.description.replace(/\(\d+\/\d+\)\s*$/, `(${k}/${p.installment.total})`),
        amountCents: p.amountCents,
        externalRef: `${auth}#${k}/${p.installment.total}`,
        occurredOn: addMonthsClamped(statement.dueOn, k - p.installment.number),
      });
    }
  }

  // Dedupe 1: refs já no banco (compras do arquivo + futuras já projetadas).
  const refs = [...statement.purchases.map((p) => p.externalRef), ...futures.map((f) => f.externalRef)];
  const { data: existingByRef, error: refError } = await supabase
    .from('transactions')
    .select('external_ref')
    .eq('credit_card_id', cardId)
    .in('external_ref', refs);
  if (refError) return { ok: false, error: GENERIC };
  const knownRefs = new Set((existingByRef ?? []).map((t) => t.external_ref));

  // Dedupe 2: compra sem ref já no cartão (lançada à mão ou gerada por
  // recorrente) com mesmo valor. Data exata pra manual; ±3 dias quando veio de
  // recorrente — o banco às vezes posta a assinatura uns dias depois.
  const dates = statement.purchases.map((p) => p.purchasedOn).sort();
  const { data: manual, error: manualError } = await supabase
    .from('transactions')
    .select('purchased_on, amount_cents, source_recurring_rule_id')
    .eq('credit_card_id', cardId)
    .is('external_ref', null)
    .gte('purchased_on', shiftDays(dates[0]!, -3))
    .lte('purchased_on', shiftDays(dates[dates.length - 1]!, 3));
  if (manualError) return { ok: false, error: GENERIC };
  const manualKeys = new Set(
    (manual ?? []).map((t) => `${t.purchased_on}:${t.amount_cents}`),
  );
  const recurringNoRef = (manual ?? []).filter((t) => t.source_recurring_rule_id !== null);
  const matchesRecurring = (p: { purchasedOn: string; amountCents: number }) =>
    recurringNoRef.some(
      (t) =>
        t.amount_cents === p.amountCents &&
        t.purchased_on !== null &&
        Math.abs(Date.parse(t.purchased_on) - Date.parse(p.purchasedOn)) <= 3 * 86_400_000,
    );

  const toImport = statement.purchases.filter(
    (p) =>
      !knownRefs.has(p.externalRef) &&
      !manualKeys.has(`${p.purchasedOn}:${p.amountCents}`) &&
      !matchesRecurring(p),
  );
  const skippedExisting = statement.purchases.length - toImport.length;
  const importedCents = toImport.reduce((sum, p) => sum + p.amountCents, 0);
  const futuresToImport = futures.filter((f) => !knownRefs.has(f.externalRef));
  const futureCents = futuresToImport.reduce((sum, f) => sum + f.amountCents, 0);

  if (!dryRun && (toImport.length > 0 || futuresToImport.length > 0)) {
    const baseRow = (p: { amountCents: number; description: string; purchasedOn: string; externalRef: string }, occurredOn: string) => ({
      household_id: session.householdId,
      profile_id: session.userId,
      account_id: card.payment_account_id,
      category_id: categoryId ?? null,
      direction: 'expense' as const,
      amount_cents: p.amountCents,
      currency: 'BRL' as const,
      description: p.description,
      occurred_on: occurredOn,
      paid_on: null,
      status: 'pending' as const,
      credit_card_id: cardId,
      purchased_on: p.purchasedOn,
      external_ref: p.externalRef,
    });
    const rows = [
      ...toImport.map((p) => baseRow(p, statement.dueOn)),
      ...futuresToImport.map((f) => baseRow(f, f.occurredOn)),
    ];
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
    importedFuture: futuresToImport.length,
    futureCents,
    skippedExisting,
    ignoredCount: statement.ignoredCount,
    importedCents,
    statementTotalCents: statement.statementTotalCents,
    dueOn: statement.dueOn,
    monthLabel: statement.monthLabel,
    dryRun,
  };
}
