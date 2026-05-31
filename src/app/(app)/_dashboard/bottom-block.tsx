import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { type Currency } from '@/components/finance/num';
import { TxnRow } from '@/components/finance/txn-row';
import { CategoryProgressList } from '@/components/finance/category-progress';
import { topCategoriesThisMonth } from '@/lib/finance/dashboard-stats';
import { listUngeneratedRecurringForMonth } from '@/lib/finance/recurring';
import {
  getDashboardSupabase,
  getDashboardAccounts,
} from '@/lib/finance/dashboard-data';

const MONTHS_PT_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const STATS_CURRENCY: Currency = 'EUR';

type Direction = 'expense' | 'income';
type Status = 'pending' | 'paid';

type TxnRowData = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  direction: Direction;
  status: Status;
  occurred_on: string;
  source_recurring_rule_id: string | null;
  source_installment_plan_id: string | null;
  installment_number: number | null;
  categories: { name: string } | null;
  installment_plans: { total_installments: number } | null;
  previsto?: boolean;
};

type Props = {
  targetDateIso: string;
  isFuture: boolean;
};

export async function BottomBlock({ targetDateIso, isFuture }: Props) {
  const session = await getSession();
  const accounts = await getDashboardAccounts(session.householdId);
  if (accounts.length === 0) return null;

  const supabase = await getDashboardSupabase();
  const targetDate = new Date(targetDateIso);
  const monthStartIso = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEndIso = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [topCats, txnsRes] = await Promise.all([
    topCategoriesThisMonth(
      supabase,
      session.householdId,
      STATS_CURRENCY,
      5,
      targetDate,
    ),
    supabase
      .from('transactions')
      .select(
        'id, description, amount_cents, currency, direction, status, occurred_on, source_recurring_rule_id, source_installment_plan_id, installment_number, categories(name), installment_plans(total_installments)',
      )
      .eq('household_id', session.householdId)
      .gte('occurred_on', monthStartIso)
      .lte('occurred_on', monthEndIso)
      .order('occurred_on', { ascending: false })
      .limit(10),
  ]);

  const txns = (txnsRes.data ?? []) as unknown as TxnRowData[];

  const virtualRows: TxnRowData[] = isFuture
    ? (
        await listUngeneratedRecurringForMonth({
          supabase,
          householdId: session.householdId,
          targetDate,
        })
      ).map((o) => ({
        id: `previsto-${o.ruleId}`,
        description: o.title,
        amount_cents: o.amountCents,
        currency: o.currency,
        direction: o.direction,
        status: 'pending' as const,
        occurred_on: o.occurredOn,
        source_recurring_rule_id: o.ruleId,
        source_installment_plan_id: null,
        installment_number: null,
        categories: o.categoryName ? { name: o.categoryName } : null,
        installment_plans: null,
        previsto: true,
      }))
    : [];

  const allRows = [...txns, ...virtualRows].sort((a, b) =>
    a.occurred_on < b.occurred_on ? 1 : a.occurred_on > b.occurred_on ? -1 : 0,
  );
  const grouped = groupByDay(allRows);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-3">
        <header className="flex items-baseline justify-between">
          <h2>Top categorias</h2>
          <span className="mono text-[10px] text-fg4">
            {MONTHS_PT_SHORT[targetDate.getMonth()]}
          </span>
        </header>
        <CategoryProgressList rows={topCats} currency={STATS_CURRENCY} />
      </section>

      {allRows.length > 0 && (
        <section className="space-y-4">
          <header className="flex items-baseline justify-between">
            <h2>Transações recentes</h2>
            <Link
              href="/transacoes"
              className="mono text-[10px] text-fg3 hover:text-fg1"
            >
              ver todas
            </Link>
          </header>
          {grouped.map(({ label, rows }) => (
            <div key={label} className="space-y-1.5">
              <p className="eyebrow px-1">{label}</p>
              <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
                {rows.map((t) =>
                  t.previsto ? (
                    <div key={t.id} data-testid="txn-row-previsto">
                      <TxnRow
                        description={t.description}
                        category={t.categories?.name ?? '—'}
                        amountCents={t.amount_cents}
                        currency={t.currency}
                        direction={t.direction}
                        previsto
                      />
                    </div>
                  ) : (
                    <TxnRow
                      key={t.id}
                      description={t.description}
                      category={t.categories?.name ?? '—'}
                      amountCents={t.amount_cents}
                      currency={t.currency}
                      direction={t.direction}
                      status={t.status === 'paid' ? 'paid' : 'pending'}
                      source={txnSource(t)}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function txnSource(t: TxnRowData):
  | { kind: 'recurring' }
  | { kind: 'installment'; number: number; total: number }
  | null {
  if (t.source_installment_plan_id && t.installment_number && t.installment_plans) {
    return {
      kind: 'installment',
      number: t.installment_number,
      total: t.installment_plans.total_installments,
    };
  }
  if (t.source_recurring_rule_id) return { kind: 'recurring' };
  return null;
}

function groupByDay(txns: TxnRowData[]): { label: string; rows: TxnRowData[] }[] {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  const groups = new Map<string, TxnRowData[]>();
  for (const t of txns) {
    const list = groups.get(t.occurred_on) ?? [];
    list.push(t);
    groups.set(t.occurred_on, list);
  }

  return Array.from(groups.entries()).map(([day, rows]) => {
    let label = day.slice(8, 10) + '/' + day.slice(5, 7);
    if (day === todayIso) label = 'Hoje';
    else if (day === yesterdayIso) label = 'Ontem';
    return { label, rows };
  });
}
