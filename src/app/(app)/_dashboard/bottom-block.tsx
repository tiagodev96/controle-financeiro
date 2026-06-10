import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { type Currency } from '@/components/finance/num';
import { TxnRow } from '@/components/finance/txn-row';
import { CategoryProgressList } from '@/components/finance/category-progress';
import { topCategoriesCrossCurrency } from '@/lib/finance/dashboard-stats';
import { listTransactionsForHousehold } from '@/lib/finance/transactions';
import { listUngeneratedRecurringForMonth } from '@/lib/finance/recurring';
import {
  getDashboardSupabase,
  getDashboardAccounts,
  getDashboardRateMap,
  hasBothCurrencies,
} from '@/lib/finance/dashboard-data';
import { MONTHS_PT_SHORT, monthIso, toIsoDate } from '@/lib/dates';

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
  nowIso: string;
  targetDateIso: string;
  isFuture: boolean;
};

export async function BottomBlock({ nowIso, targetDateIso, isFuture }: Props) {
  const session = await getSession();
  const accounts = await getDashboardAccounts(session.householdId);
  if (accounts.length === 0) return null;

  const supabase = await getDashboardSupabase();
  const targetDate = new Date(targetDateIso);

  const displayCurrency = session.preferredDisplayCurrency;
  const both = hasBothCurrencies(accounts);
  const rateMap = both ? await getDashboardRateMap(nowIso) : null;

  const [topCats, txnsRes] = await Promise.all([
    topCategoriesCrossCurrency({
      supabase,
      householdId: session.householdId,
      displayCurrency,
      fxRateMap: rateMap,
      limit: 5,
      now: targetDate,
    }),
    listTransactionsForHousehold(supabase, {
      householdId: session.householdId,
      monthIso: monthIso(targetDate),
      limit: 10,
    }),
  ]);

  const txns: TxnRowData[] = txnsRes.transactions.map((t) => ({
    id: t.id,
    description: t.description,
    amount_cents: t.amount_cents,
    currency: t.currency,
    direction: t.direction,
    status: t.status,
    occurred_on: t.occurred_on,
    source_recurring_rule_id: t.source_recurring_rule_id,
    source_installment_plan_id: t.source_installment_plan_id,
    installment_number: t.installment_number,
    categories: t.categories,
    installment_plans: t.installment_plans,
  }));

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
            {topCats.fxIncomplete && <span className="mr-2">câmbio indisponível · parcial</span>}
            {MONTHS_PT_SHORT[targetDate.getMonth()]}
          </span>
        </header>
        <CategoryProgressList rows={topCats.rows} currency={displayCurrency} />
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
  const todayIso = toIsoDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = toIsoDate(yesterday);

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
