import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { monthsUntil } from './debt-deadline';

export type DebtRow = {
  id: string;
  title: string;
  original_amount_cents: number;
  remaining_amount_cents: number;
  currency: Currency;
  priority: 1 | 2 | 3;
  status: 'open' | 'closed';
  notes: string | null;
  closed_at: string | null;
  target_quit_date: string | null;
};

export type DebtListResult = {
  open: DebtRow[];
  closed: DebtRow[];
};

/**
 * Lista todas dívidas do household, ordenadas:
 * - abertas: priority asc, depois remaining desc
 * - fechadas: closed_at desc
 */
export async function listDebtsForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<DebtListResult> {
  const { data, error } = await supabase
    .from('debts')
    .select(
      'id, title, original_amount_cents, remaining_amount_cents, currency, priority, status, notes, closed_at, target_quit_date',
    )
    .eq('household_id', householdId);

  if (error) throw new Error(`listDebtsForHousehold: ${error.message}`);

  const all = (data ?? []) as DebtRow[];

  const open = all
    .filter((d) => d.status === 'open')
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.remaining_amount_cents - a.remaining_amount_cents;
    });

  const closed = all
    .filter((d) => d.status === 'closed')
    .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''));

  return { open, closed };
}

function monthRange(now: Date): { start: string; end: string } {
  // ISO montado de componentes locais — toISOString converteria pra UTC e
  // deslocaria a borda do mês em fusos positivos.
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  return {
    start: first(y, m),
    end: m === 11 ? first(y + 1, 0) : first(y, m + 1),
  };
}

/**
 * Filtra dívidas fechadas pra só as que foram quitadas dentro do mês de
 * `targetDate` (closed_at no intervalo). closed_at é timestamptz; a data
 * UTC basta pra casar o mês, consistente com sumDebtPaymentsThisMonth.
 */
export function debtsClosedInMonth(closed: DebtRow[], targetDate: Date): DebtRow[] {
  const { start, end } = monthRange(targetDate);
  return closed.filter((d) => {
    if (!d.closed_at) return false;
    const day = d.closed_at.slice(0, 10);
    return day >= start && day < end;
  });
}

/**
 * Soma valor pago por dívida no mês corrente (status=paid, paid_on no
 * intervalo). Retorna map debtId → cents. Apenas debt_ids que tiveram
 * pagamento aparecem.
 */
export async function sumDebtPaymentsThisMonth(
  supabase: SupabaseClient<Database>,
  householdId: string,
  now: Date,
): Promise<Record<string, number>> {
  const { start, end } = monthRange(now);
  const { data, error } = await supabase
    .from('transactions')
    .select('source_debt_id, amount_cents')
    .eq('household_id', householdId)
    .eq('status', 'paid')
    .not('source_debt_id', 'is', null)
    .gte('paid_on', start)
    .lt('paid_on', end);

  if (error) throw new Error(`sumDebtPaymentsThisMonth: ${error.message}`);

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.source_debt_id) continue;
    map[row.source_debt_id] = (map[row.source_debt_id] ?? 0) + row.amount_cents;
  }
  return map;
}

export type DebtPace = { paceCents: number; monthsElapsed: number };

/**
 * Ritmo médio de pagamento da dívida: total pago dividido pelos meses
 * decorridos desde o primeiro pagamento (inclusive o mês corrente).
 * Retorna null se a dívida nunca recebeu pagamento.
 */
export async function debtPaymentPace(
  supabase: SupabaseClient<Database>,
  householdId: string,
  debtId: string,
  now: Date,
): Promise<DebtPace | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount_cents, paid_on')
    .eq('household_id', householdId)
    .eq('source_debt_id', debtId)
    .eq('status', 'paid')
    .not('paid_on', 'is', null);

  if (error) throw new Error(`debtPaymentPace: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  let total = 0;
  let firstPaidOn = rows[0]!.paid_on!;
  for (const row of rows) {
    total += row.amount_cents;
    if (row.paid_on! < firstPaidOn) firstPaidOn = row.paid_on!;
  }

  const nowIso = now.toISOString().slice(0, 10);
  const monthsElapsed = monthsUntil(nowIso, firstPaidOn) + 1;
  return { paceCents: Math.round(total / monthsElapsed), monthsElapsed };
}
