import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { TransactionFilters } from '@/components/finance/transaction-filters';
import { Num, type Currency } from '@/components/finance/num';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import {
  TransactionsList,
  type Transaction,
} from '@/components/finance/transactions-list';
import { listTransactionsForHousehold, type Status } from '@/lib/finance/transactions';
import { listUngeneratedRecurringForMonth } from '@/lib/finance/recurring';
import { listAllCategoriesForHousehold } from '@/lib/finance/categories';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { convertCents, FxUnavailableError, getRateMap, type RateMap } from '@/lib/fx';

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const VALID_MONTH = /^\d{4}-\d{2}$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseStatus(raw: string | undefined): Status | undefined {
  if (raw === 'pending' || raw === 'paid') return raw;
  return undefined;
}

function parseDateParam(raw: string | undefined): string | undefined {
  if (!raw || !VALID_DATE.test(raw)) return undefined;
  return raw;
}

function parseCategoryParam(raw: string | undefined): string | 'none' | undefined {
  if (!raw || raw === 'all') return undefined;
  if (raw === 'none') return 'none';
  if (UUID_RE.test(raw)) return raw;
  return undefined;
}

function groupByDay(txns: Transaction[]): { label: string; rows: Transaction[] }[] {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    // Agrupa pela "data efetiva": paid_on quando pago, senão occurred_on.
    const key = t.paid_on ?? t.occurred_on;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([day, rows]) => {
    let label = day.slice(8, 10) + '/' + day.slice(5, 7);
    if (day === todayIso) label = 'Hoje';
    else if (day === yesterdayIso) label = 'Ontem';
    return { label, rows };
  });
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransacoesPage({ searchParams }: Props) {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const params = await searchParams;
  const defaultMonth = currentMonthIso();
  const status = parseStatus(typeof params.status === 'string' ? params.status : undefined);
  const accountId = typeof params.conta === 'string' && params.conta !== 'all' ? params.conta : undefined;
  const categoryId = parseCategoryParam(typeof params.categoria === 'string' ? params.categoria : undefined);
  const startDate = parseDateParam(typeof params.dataInicio === 'string' ? params.dataInicio : undefined);
  const endDate = parseDateParam(typeof params.dataFim === 'string' ? params.dataFim : undefined);
  const queryStr = typeof params.q === 'string' ? params.q.slice(0, 100) : undefined;

  // Se há range de datas, ignora o mês (precedência no helper).
  const mesRaw = typeof params.mes === 'string' ? params.mes : defaultMonth;
  const monthIso =
    startDate || endDate
      ? undefined
      : mesRaw === 'all'
        ? undefined
        : VALID_MONTH.test(mesRaw)
          ? mesRaw
          : defaultMonth;

  const [{ transactions: txns, total }, filterAccountsRes, allCategories, allAccounts] =
    await Promise.all([
      listTransactionsForHousehold(supabase, {
        householdId: session.householdId,
        status,
        accountId,
        categoryId,
        monthIso,
        startDate,
        endDate,
        query: queryStr,
      }),
      supabase
        .from('accounts')
        .select('id, name')
        .eq('is_archived', false)
        .order('sort_order', { ascending: true }),
      listAllCategoriesForHousehold(supabase, session.householdId),
      listAllAccountsForHousehold(supabase, session.householdId),
    ]);

  const filterAccounts = (filterAccountsRes.data ?? []).map((a) => ({ id: a.id, name: a.name }));
  const filterCategories = allCategories
    .filter((c) => !c.is_archived)
    .map((c) => ({ id: c.id, name: c.name }));

  // Preview de recorrentes em mês futuro: vira linhas "previsto" (virtuais, sem
  // gravar) só no modo mês, sem narrowing por status/conta. Filtros de
  // categoria/busca ainda aplicam. Fonte única compartilhada com a sobra.
  const showPrevistos =
    monthIso != null && monthIso > currentMonthIso() && !status && !accountId;
  let virtualRows: Transaction[] = [];
  if (showPrevistos && monthIso) {
    const [yy, mm] = monthIso.split('-').map(Number) as [number, number];
    const targetDate = new Date(yy, mm, 0);
    const occ = await listUngeneratedRecurringForMonth({
      supabase,
      householdId: session.householdId,
      targetDate,
    });
    const q = queryStr?.toLowerCase();
    virtualRows = occ
      .filter((o) =>
        categoryId === 'none'
          ? o.categoryId === null
          : categoryId
            ? o.categoryId === categoryId
            : true,
      )
      .filter((o) => (q ? o.title.toLowerCase().includes(q) : true))
      .map((o) => ({
        id: `previsto-${o.ruleId}`,
        description: o.title,
        amount_cents: o.amountCents,
        currency: o.currency,
        direction: o.direction,
        status: 'pending' as const,
        occurred_on: o.occurredOn,
        paid_on: null,
        category_id: o.categoryId,
        account_id: '',
        source_recurring_rule_id: o.ruleId,
        source_installment_plan_id: null,
        installment_number: null,
        categories: o.categoryName ? { name: o.categoryName } : null,
        installment_plans: null,
        previsto: true,
      }));
  }

  const allRows: Transaction[] = [...(txns as Transaction[]), ...virtualRows];

  const totalsByCurrency: Record<'EUR' | 'BRL', { expense: number; income: number }> = {
    EUR: { expense: 0, income: 0 },
    BRL: { expense: 0, income: 0 },
  };
  for (const t of allRows) {
    const bucket = totalsByCurrency[t.currency];
    if (t.direction === 'expense') bucket.expense += t.amount_cents;
    else bucket.income += t.amount_cents;
  }
  const totalsList = (['EUR', 'BRL'] as const)
    .map((cur) => ({ currency: cur, ...totalsByCurrency[cur] }))
    .filter((row) => row.expense > 0 || row.income > 0);
  const hasBothCurrencies = totalsList.length === 2;
  const displayCurrency: Currency = session.preferredDisplayCurrency;

  let rateMap: RateMap | null = null;
  if (hasBothCurrencies) {
    try {
      rateMap = await getRateMap({
        supabase,
        serviceSupabase: getServiceRoleSupabase(),
        when: new Date(),
      });
    } catch (err) {
      if (!(err instanceof FxUnavailableError)) throw err;
    }
  }

  function toDisplay(cents: number, from: Currency): number {
    if (from === displayCurrency) return cents;
    if (!rateMap) return 0;
    const rate = displayCurrency === 'EUR' ? rateMap.BRL_EUR : rateMap.EUR_BRL;
    return convertCents(cents, rate);
  }

  const convertedTotals = hasBothCurrencies && rateMap
    ? {
        expense: totalsList.reduce((sum, r) => sum + toDisplay(r.expense, r.currency), 0),
        income: totalsList.reduce((sum, r) => sum + toDisplay(r.income, r.currency), 0),
      }
    : null;

  // Coberturas (conversão/transferência entre contas) entram só na lista, nunca
  // nos totais de despesa/entrada — são neutras no fluxo de caixa. Escondidas
  // sob filtro de status/categoria (não têm nenhum dos dois).
  let transferRows: Transaction[] = [];
  if (!status && !categoryId) {
    let transferQuery = supabase
      .from('account_transfers')
      .select('id, from_amount_cents, to_amount_cents, from_currency, to_currency, occurred_on')
      .order('created_at', { ascending: false });
    if (monthIso) {
      const [yy, mm] = monthIso.split('-').map(Number) as [number, number];
      const nextMonth =
        mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
      transferQuery = transferQuery
        .gte('occurred_on', `${monthIso}-01`)
        .lt('occurred_on', nextMonth);
    } else {
      if (startDate) transferQuery = transferQuery.gte('occurred_on', startDate);
      if (endDate) transferQuery = transferQuery.lte('occurred_on', endDate);
    }
    if (accountId && UUID_RE.test(accountId)) {
      transferQuery = transferQuery.or(
        `from_account_id.eq.${accountId},to_account_id.eq.${accountId}`,
      );
    }
    const { data: transfers } = await transferQuery;
    transferRows = (transfers ?? []).map((tr) => ({
      id: `transfer-${tr.id}`,
      description: tr.from_currency === tr.to_currency ? 'Transferência' : 'Conversão',
      amount_cents: tr.to_amount_cents,
      currency: tr.to_currency as Currency,
      direction: 'expense',
      status: 'paid',
      occurred_on: tr.occurred_on,
      paid_on: tr.occurred_on,
      category_id: null,
      account_id: '',
      source_recurring_rule_id: null,
      source_installment_plan_id: null,
      installment_number: null,
      categories: null,
      installment_plans: null,
      transfer: {
        fromCents: tr.from_amount_cents,
        fromCurrency: tr.from_currency as Currency,
        toCents: tr.to_amount_cents,
        toCurrency: tr.to_currency as Currency,
      },
    }));
  }

  const grouped = groupByDay([...allRows, ...transferRows]);
  const displayTotal = total + virtualRows.length;
  const eyebrow = `${displayTotal} ${displayTotal === 1 ? 'lançamento' : 'lançamentos'}`;

  return (
    <section className="space-y-5">
      <AppTopBar eyebrow={eyebrow} title="Transações" />

      <TransactionFilters
        accounts={filterAccounts}
        categories={filterCategories}
        defaultMonth={defaultMonth}
      />

      {allRows.length > 0 && totalsList.length > 0 && (
        <div className="space-y-2 rounded-md border border-border-soft bg-bg-surface px-4 py-3 text-sm">
          {convertedTotals && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-2 border-b border-border-soft">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="mono text-[10px] uppercase tracking-wider text-fg4">
                  total · {displayCurrency.toLowerCase()}
                </span>
                {convertedTotals.expense > 0 && (
                  <span className="flex items-baseline gap-1.5">
                    <span className="caption">despesa</span>
                    <Num
                      cents={convertedTotals.expense}
                      currency={displayCurrency}
                      className="text-[14px] font-semibold text-money-negative"
                    />
                  </span>
                )}
                {convertedTotals.income > 0 && (
                  <span className="flex items-baseline gap-1.5">
                    <span className="caption">entrada</span>
                    <Num
                      cents={convertedTotals.income}
                      currency={displayCurrency}
                      className="text-[14px] font-semibold text-money-positive"
                    />
                  </span>
                )}
              </div>
              <CurrencyToggle current={displayCurrency} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {totalsList.map((row) => (
              <div key={row.currency} className="flex flex-wrap items-baseline gap-3">
                <span className="mono text-[10px] uppercase tracking-wider text-fg4">
                  {row.currency}
                </span>
                {row.expense > 0 && (
                  <span className="flex items-baseline gap-1.5">
                    <span className="caption">despesa</span>
                    <Num
                      cents={row.expense}
                      currency={row.currency}
                      className="text-[14px] font-semibold text-money-negative"
                    />
                  </span>
                )}
                {row.income > 0 && (
                  <span className="flex items-baseline gap-1.5">
                    <span className="caption">entrada</span>
                    <Num
                      cents={row.income}
                      currency={row.currency}
                      className="text-[14px] font-semibold text-money-positive"
                    />
                  </span>
                )}
              </div>
            ))}
            {total > txns.length && (
              <span className="mono ml-auto text-[10px] text-fg4">
                mostrando {txns.length} de {total}
              </span>
            )}
          </div>
        </div>
      )}

      {allRows.length === 0 ? (
        total === 0 ? (
          <FreshEmpty />
        ) : (
          <FilterEmpty />
        )
      ) : (
        <TransactionsList
          groups={grouped}
          categories={allCategories}
          accounts={allAccounts}
        />
      )}
    </section>
  );
}

function FreshEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border-soft bg-bg-surface p-8 text-center">
      <p className="text-fg3">Sem transações ainda.</p>
      <Link
        href="/lancar"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-fg-on-brand hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Lançar despesa
      </Link>
    </div>
  );
}

function FilterEmpty() {
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
      Sem transações pra esse filtro.
    </div>
  );
}
