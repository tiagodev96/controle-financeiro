import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { HeroNumber, Num, type Currency } from '@/components/finance/num';
import { CCY } from '@/components/finance/ccy';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { TxnRow } from '@/components/finance/txn-row';
import { StatTrio } from '@/components/finance/stat-trio';
import { CategoryProgressList } from '@/components/finance/category-progress';
import { SobraPrevistaCard } from '@/components/finance/sobra-prevista-card';
import {
  calculateMonthStats,
  topCategoriesThisMonth,
} from '@/lib/finance/dashboard-stats';
import {
  convertCents,
  FxUnavailableError,
  getRateMap,
  type RateMap,
} from '@/lib/fx';
import { listDebtsForHousehold } from '@/lib/finance/debts';
import { computeDebtSuggestion } from '@/lib/finance/debt-suggestion';
import { DebtSuggestionCard } from '@/components/finance/debt-suggestion-card';
import { listUpcomingPending } from '@/lib/finance/upcoming';

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
};

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const MONTHS_PT_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthEyebrow(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} · ${d.getFullYear()}`;
}

function endOfMonthLabel(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${String(last.getDate()).padStart(2, '0')} ${MONTHS_PT_SHORT[last.getMonth()]}`;
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

function formatRate(rate: number): string {
  return rate.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function shortDayLabel(iso: string, now: Date): string {
  const today = isoLocal(now);
  if (iso === today) return 'hoje';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === isoLocal(tomorrow)) return 'amanhã';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function isoLocal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function loadRateMap(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  now: Date,
): Promise<RateMap | null> {
  try {
    return await getRateMap({
      supabase,
      serviceSupabase: getServiceRoleSupabase(),
      when: now,
    });
  } catch (err) {
    if (err instanceof FxUnavailableError) return null;
    throw err;
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const now = new Date();
  const displayCurrency: Currency = session.preferredDisplayCurrency;
  const otherCurrency: Currency = displayCurrency === 'EUR' ? 'BRL' : 'EUR';
  const statsCurrency: Currency = 'EUR';

  const accountsRes = await supabase
    .from('accounts')
    .select('id, name, currency, balance_cents')
    .eq('is_archived', false);

  const accounts = accountsRes.data ?? [];
  const balanceByCurrency = accounts.reduce<Record<Currency, number>>(
    (acc, a) => {
      const cur = a.currency as Currency;
      acc[cur] = (acc[cur] ?? 0) + a.balance_cents;
      return acc;
    },
    { BRL: 0, EUR: 0 },
  );

  const hasBothCurrencies =
    accounts.some((a) => a.currency === 'EUR') &&
    accounts.some((a) => a.currency === 'BRL');

  const rateMap = hasBothCurrencies ? await loadRateMap(supabase, now) : null;

  const totalInDisplay = rateMap
    ? balanceByCurrency[displayCurrency] +
      convertCents(
        balanceByCurrency[otherCurrency],
        displayCurrency === 'EUR' ? rateMap.BRL_EUR : rateMap.EUR_BRL,
      )
    : balanceByCurrency[displayCurrency];

  const [stats, topCats, txnsRes, debts, upcoming] = await Promise.all([
    calculateMonthStats(supabase, session.householdId, statsCurrency, balanceByCurrency[statsCurrency], now),
    topCategoriesThisMonth(supabase, session.householdId, statsCurrency, 5, now),
    supabase
      .from('transactions')
      .select(
        'id, description, amount_cents, currency, direction, status, occurred_on, source_recurring_rule_id, source_installment_plan_id, installment_number, categories(name), installment_plans(total_installments)',
      )
      .eq('household_id', session.householdId)
      .order('occurred_on', { ascending: false })
      .limit(10),
    listDebtsForHousehold(supabase, session.householdId),
    listUpcomingPending(supabase, session.householdId, now, 7),
  ]);

  const txns = (txnsRes.data ?? []) as unknown as TxnRowData[];
  const grouped = groupByDay(txns);
  const hasData = txns.length > 0 || accounts.some((a) => a.balance_cents !== 0);

  const suggestion = computeDebtSuggestion({
    sobraEurCents: stats.sobraPrevistaCents - balanceByCurrency.EUR,
    openDebts: debts.open.map((d) => ({
      id: d.id,
      title: d.title,
      currency: d.currency,
      priority: d.priority,
      remainingCents: d.remaining_amount_cents,
    })),
    fxRateMap: rateMap ? { EUR_BRL: rateMap.EUR_BRL, BRL_EUR: rateMap.BRL_EUR } : null,
  });

  const suggestionAccounts = accounts
    .filter((a) => suggestion && a.currency === suggestion.debt.currency)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency as Currency }));

  return (
    <section className="space-y-6 cf-fade-up">
      <AppTopBar eyebrow={monthEyebrow(now)} title="Dashboard" />

      {!hasData ? (
        <EmptyHero />
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="rounded-md border border-border-soft bg-bg-surface p-5 lg:p-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] text-fg3">
                  {hasBothCurrencies && rateMap ? 'Saldo total' : 'Saldo atual'}
                </p>
                {hasBothCurrencies && <CurrencyToggle current={displayCurrency} />}
              </div>
              <HeroNumber cents={totalInDisplay} currency={displayCurrency} />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <CCY code="EUR" />
                <Num cents={balanceByCurrency.EUR} currency="EUR" className="text-[11px] text-fg3" />
                <span className="text-fg5">·</span>
                <CCY code="BRL" />
                <Num cents={balanceByCurrency.BRL} currency="BRL" className="text-[11px] text-fg3" />
                {rateMap ? (
                  <span className="ml-auto mono text-[10px] text-fg4">
                    1 € = R$ {formatRate(rateMap.EUR_BRL)} · {shortDate(rateMap.rateDate)}
                    {rateMap.isStale && ' (desatualizada)'}
                  </span>
                ) : hasBothCurrencies ? (
                  <span className="ml-auto mono text-[10px] uppercase tracking-wider text-status-overdue-fg bg-status-overdue-bg rounded-xs px-1.5 py-0.5">
                    Câmbio indisponível
                  </span>
                ) : null}
              </div>
            </div>
            <SobraPrevistaCard stats={stats} currency={statsCurrency} endOfMonthLabel={endOfMonthLabel(now)} />
          </section>

          <StatTrio stats={stats} currency={statsCurrency} />

          {suggestion && (
            <DebtSuggestionCard
              debtId={suggestion.debt.id}
              debtTitle={suggestion.debt.title}
              debtCurrency={suggestion.debt.currency}
              debtRemainingCents={suggestion.debt.remainingCents}
              suggestedCents={suggestion.suggestedCents}
              percOfDebt={suggestion.percOfDebt}
              sobraEurCents={stats.sobraPrevistaCents - balanceByCurrency.EUR}
              accounts={suggestionAccounts}
            />
          )}

          {upcoming.length > 0 && (
            <section className="space-y-2">
              <header className="flex items-baseline justify-between">
                <h2>Próximos 7 dias</h2>
                <span className="mono text-[10px] text-fg4">{upcoming.length} venc.</span>
              </header>
              <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
                {upcoming.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5 text-[14px]">
                    <span className="mono inline-flex w-12 shrink-0 text-[10px] text-fg4">
                      {shortDayLabel(u.occurred_on, now)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fg2">{u.description}</span>
                    <Num
                      cents={u.amount_cents}
                      currency={u.currency}
                      className={u.direction === 'income' ? 'shrink-0 font-semibold text-money-positive' : 'shrink-0 font-semibold text-money-negative'}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <section className="space-y-3">
              <header className="flex items-baseline justify-between">
                <h2>Top categorias</h2>
                <span className="mono text-[10px] text-fg4">{MONTHS_PT_SHORT[now.getMonth()]}</span>
              </header>
              <CategoryProgressList rows={topCats} currency={statsCurrency} />
            </section>

            {txns.length > 0 && (
              <section className="space-y-4">
                <header className="flex items-baseline justify-between">
                  <h2>Transações recentes</h2>
                  <Link href="/transacoes" className="mono text-[10px] text-fg3 hover:text-fg1">
                    ver todas
                  </Link>
                </header>
                {grouped.map(({ label, rows }) => (
                  <div key={label} className="space-y-1.5">
                    <p className="eyebrow px-1">{label}</p>
                    <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
                      {rows.map((t) => (
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
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function EmptyHero() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-border-soft bg-bg-surface p-8 text-center cf-fade-up">
      <div className="space-y-2">
        <h2>Sem transações ainda.</h2>
        <p className="text-sm text-fg3">
          O dashboard ganha vida quando há movimentação.
        </p>
      </div>
      <Link
        href="/lancar"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cf-press"
      >
        <Plus className="size-4" strokeWidth={1.6} aria-hidden />
        Lançar primeira despesa
      </Link>
    </div>
  );
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
