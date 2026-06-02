import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { HeroNumber, Num, type Currency } from '@/components/finance/num';
import { SharePngActions } from '@/components/finance/share-png-actions';
import { MonthPicker } from '@/components/finance/dashboard-month-picker';
import { ResumoCurrencyToggle } from '@/components/finance/resumo-currency-toggle';
import {
  calculateCrossCurrencyMonthStats,
  type CrossCurrencyMonthStats,
} from '@/lib/finance/cross-currency-stats';
import { projectMonth, type MonthProjection } from '@/lib/finance/month-projection';
import { getBalanceByAccountOn } from '@/lib/finance/balance-history';
import { listDebtsForHousehold, sumDebtPaymentsThisMonth } from '@/lib/finance/debts';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { buildMonthSummaryText, type FxRateMap } from '@/lib/finance/month-summary';
import { convertCents, getRateMap, FxUnavailableError, type RateMap } from '@/lib/fx';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthEyebrow(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} · ${d.getFullYear()}`;
}

type SearchParams = Promise<{ mes?: string; moeda?: string }>;

function parseMonthParam(
  raw: string | undefined,
  now: Date,
): { targetDate: Date; monthIso: string; isPast: boolean; isFuture: boolean } {
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const match = raw && /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const monthIso = `${y}-${String(m).padStart(2, '0')}`;
  if (monthIso === currentIso) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  // Último dia do mês alvo — preserva semântica de "fim do mês" pra stats.
  const targetDate = new Date(y, m, 0);
  return {
    targetDate,
    monthIso,
    isPast: monthIso < currentIso,
    isFuture: monthIso > currentIso,
  };
}

function parseMoedaParam(raw: string | undefined, fallback: Currency): Currency {
  if (raw === 'EUR' || raw === 'eur') return 'EUR';
  if (raw === 'BRL' || raw === 'brl') return 'BRL';
  return fallback;
}

export default async function ResumoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const now = new Date();
  const params = await searchParams;
  const { targetDate, monthIso, isPast, isFuture } = parseMonthParam(params.mes, now);
  const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const primary: Currency = parseMoedaParam(params.moeda, 'EUR');

  const [accountsAll, { open: openDebts }, debtPaymentsByDebtId] = await Promise.all([
    listAllAccountsForHousehold(supabase, session.householdId),
    listDebtsForHousehold(supabase, session.householdId),
    sumDebtPaymentsThisMonth(supabase, session.householdId, targetDate),
  ]);

  let fxRateMap: RateMap | null = null;
  try {
    fxRateMap = await getRateMap({
      supabase,
      serviceSupabase: getServiceRoleSupabase(),
      when: now,
    });
  } catch (err) {
    if (!(err instanceof FxUnavailableError)) throw err;
  }
  const fxRateMapSlim: FxRateMap | null = fxRateMap
    ? { EUR_BRL: fxRateMap.EUR_BRL, BRL_EUR: fxRateMap.BRL_EUR }
    : null;

  const accounts = accountsAll.filter((a) => !a.is_archived);
  const hasBothCurrencies =
    accounts.some((a) => a.currency === 'EUR') &&
    accounts.some((a) => a.currency === 'BRL');

  // Soma de TODAS as contas, convertendo cada uma pra `primary` (moeda
  // selecionada no toggle). Se não tem fxRateMap e há contas em currency
  // diferente da primary, essas viram 0 e marcamos `fxIncomplete`.
  const accountsTotalInPrimary = (() => {
    let total = 0;
    let fxIncomplete = false;
    for (const a of accounts) {
      if (a.currency === primary) {
        total += a.balance_cents;
      } else if (fxRateMap) {
        const rate = primary === 'EUR' ? fxRateMap.BRL_EUR : fxRateMap.EUR_BRL;
        total += convertCents(a.balance_cents, rate);
      } else {
        fxIncomplete = true;
      }
    }
    return { cents: total, fxIncomplete };
  })();

  // Stats cross-currency (tudo já convertido pra primary). Aqui dentro
  // rodam paid/pending income+expense, overdue, top categorias e o
  // saldoPrevistoFimDoMes (= accountsTotalInPrimary + pendingIncome - pendingExpense).
  const stats: CrossCurrencyMonthStats = await calculateCrossCurrencyMonthStats({
    supabase,
    householdId: session.householdId,
    targetCurrency: primary,
    fxRateMap,
    accountsTotalInTargetCents: accountsTotalInPrimary.cents,
    targetDate,
    topCategoriesLimit: 3,
  });

  const projection: MonthProjection | null = isFuture
    ? await projectMonth({
        supabase,
        householdId: session.householdId,
        targetCurrency: primary,
        fxRateMap,
        accountsTotalInTargetCents: accountsTotalInPrimary.cents,
        targetDate,
        now,
        topCategoriesLimit: 3,
      })
    : null;

  const entradasMesCents = stats.paidIncomeCents;
  const despesasPaidCents = stats.paidExpenseCents;
  const despesasPendingCents = stats.pendingExpenseCents;
  const saldoPrevistoFimDoMesCents = stats.saldoPrevistoFimDoMesCents;
  const monthFlowNetCents = entradasMesCents - despesasPaidCents;

  const hasData =
    accounts.length > 0 ||
    openDebts.length > 0 ||
    stats.topCategories.length > 0 ||
    despesasPaidCents > 0 ||
    despesasPendingCents > 0 ||
    (projection !== null && projection.expenseProjectedCents > 0);

  const summaryText = buildMonthSummaryText({
    now: targetDate,
    primaryCurrency: primary,
    saldoPrevistoFimDoMesCents,
    sobraPrevistaCents: saldoPrevistoFimDoMesCents - accountsTotalInPrimary.cents,
    entradasMesCents,
    despesasPaidCents,
    despesasPendingCents,
    overdueCents: stats.overdueCents,
    overdueCount: stats.overdueCount,
    topCategories: stats.topCategories.map((c) => ({ name: c.name, totalCents: c.totalCents })),
    openDebts: openDebts.map((d) => ({
      id: d.id,
      title: d.title,
      currency: d.currency,
      remainingCents: d.remaining_amount_cents,
    })),
    debtPaymentsByDebtId,
    accounts: accounts.map((a) => ({
      name: a.name,
      currency: a.currency,
      balanceCents: a.balance_cents,
    })),
    fxRateMap: fxRateMapSlim,
  });

  // Saldo histórico: pra mês passado, busca snapshot mais recente <= fim do
  // mês pra TODAS as accounts. Soma converte cada uma pra `primary`. Se
  // todas têm snapshot E não tem fx incompleta, usa como hero
  // ("Saldo em X"); senão cai pro fluxo ("Sobra de X").
  const historicalLookup = isPast
    ? await getBalanceByAccountOn(
        supabase,
        accounts.map((a) => ({ id: a.id, balance_cents: a.balance_cents })),
        targetDate,
      )
    : null;
  let historicalBalanceCents = 0;
  let historicalAllFromSnapshot = accounts.length > 0;
  let historicalFxIncomplete = false;
  if (historicalLookup) {
    for (const a of accounts) {
      const lookup = historicalLookup[a.id];
      if (!lookup) {
        historicalAllFromSnapshot = false;
        continue;
      }
      if (lookup.source !== 'snapshot') historicalAllFromSnapshot = false;
      if (a.currency === primary) {
        historicalBalanceCents += lookup.cents;
      } else if (fxRateMap) {
        const rate = primary === 'EUR' ? fxRateMap.BRL_EUR : fxRateMap.EUR_BRL;
        historicalBalanceCents += convertCents(lookup.cents, rate);
      } else {
        historicalFxIncomplete = true;
      }
    }
  }
  const showHistoricalBalance = historicalAllFromSnapshot && !historicalFxIncomplete;

  const heroLabel = isFuture
    ? `Sobra projetada de ${monthEyebrow(targetDate)}`
    : isPast && showHistoricalBalance
      ? `Saldo em ${monthEyebrow(targetDate)}`
      : isPast
        ? `Sobra de ${monthEyebrow(targetDate)}`
        : 'Saldo previsto fim do mês';
  const heroValue = isFuture
    ? projection!.sobraProjetadaCents
    : isPast && showHistoricalBalance
      ? historicalBalanceCents
      : isPast
        ? monthFlowNetCents
        : saldoPrevistoFimDoMesCents;

  const displayEntradas = isFuture ? projection!.incomeProjectedCents : entradasMesCents;
  const displayDespesas = isFuture
    ? projection!.expenseProjectedCents
    : despesasPaidCents + despesasPendingCents;
  const displayTopCats = isFuture
    ? projection!.topCategoriesProjected
    : stats.topCategories.map((c) => ({ id: c.id, name: c.name, totalCents: c.totalCents }));

  const eyebrow = isFuture
    ? `projetando ${monthEyebrow(targetDate)}`
    : isPast
      ? `visualizando ${monthEyebrow(targetDate)}`
      : monthEyebrow(now);

  return (
    <section className="space-y-6 cf-fade-up">
      <AppTopBar
        eyebrow={eyebrow}
        title="Resumo do mês"
        trailing={
          <div className="flex items-center gap-2">
            <ResumoCurrencyToggle
              current={primary}
              preservedQuery={monthIso !== currentMonthIso ? { mes: monthIso } : {}}
            />
            <MonthPicker
              value={monthIso}
              currentMonth={currentMonthIso}
              basePath="/resumo"
              preservedQuery={primary !== 'EUR' ? { moeda: primary.toLowerCase() } : {}}
            />
          </div>
        }
      />

      {!hasData ? (
        <EmptyHero isPast={isPast || isFuture} />
      ) : (
        <>
          <section className="space-y-4 rounded-md border border-border-soft bg-bg-surface p-5">
            <div className="space-y-1">
              <p className="text-[13px] text-fg3">{heroLabel}</p>
              <HeroNumber cents={heroValue} currency={primary} />
            </div>
            {isFuture && (
              <p className="text-[11px] text-fg4">
                projeção: recorrentes ativas + parcelas previstas + saldo atual
              </p>
            )}
            {isPast && showHistoricalBalance && (
              <p className="text-[11px] text-fg4">
                saldo do snapshot mais recente do mês
                {hasBothCurrencies && ` em ${primary}`}
              </p>
            )}
            {isPast && !showHistoricalBalance && (
              <p className="text-[11px] text-fg4">
                {historicalFxIncomplete
                  ? 'fx indisponível — saldo histórico em outra moeda não foi convertido'
                  : 'estimado a partir do fluxo — snapshot ainda não capturado pra essa data'}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <p className="eyebrow px-1">
              {isFuture ? 'Movimentação projetada' : 'Movimentação do mês'}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                label={isFuture ? 'Entradas previstas' : 'Entradas'}
                cents={displayEntradas}
                currency={primary}
                tone="positive"
              />
              <Tile
                label={isFuture ? 'Despesas previstas' : 'Despesas'}
                cents={displayDespesas}
                currency={primary}
                tone="negative"
              />
            </div>
            {isFuture ? (
              <p className="px-1 text-[12px] text-fg4">
                Recorrentes projetadas{' '}
                <Num
                  cents={projection!.recurringPendingExpenseCents}
                  currency={primary}
                  className="text-fg2"
                />{' '}
                · parcelas a vencer{' '}
                <Num cents={despesasPendingCents} currency={primary} className="text-fg2" />
              </p>
            ) : isPast ? (
              <p className="px-1 text-[12px] text-fg4">
                Já pago{' '}
                <Num cents={despesasPaidCents} currency={primary} className="text-fg2" />
                {despesasPendingCents > 0 && (
                  <>
                    {' '}·{' '}esquecido{' '}
                    <Num
                      cents={despesasPendingCents}
                      currency={primary}
                      className="text-money-negative"
                    />{' '}
                    ({stats.pendingExpenseCount}{' '}
                    {stats.pendingExpenseCount === 1 ? 'item' : 'itens'} sem marcar pago)
                  </>
                )}
              </p>
            ) : (
              <p className="px-1 text-[12px] text-fg4">
                Já pago{' '}
                <Num cents={despesasPaidCents} currency={primary} className="text-fg2" /> ·
                {' '}pendente{' '}
                <Num cents={despesasPendingCents} currency={primary} className="text-fg2" />
                {stats.overdueCount > 0 && (
                  <>
                    {' '}·{' '}em atraso{' '}
                    <Num
                      cents={stats.overdueCents}
                      currency={primary}
                      className="text-money-negative"
                    />{' '}
                    ({stats.overdueCount})
                  </>
                )}
              </p>
            )}
          </section>

          {displayTopCats.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">
                {isFuture ? 'Top categorias previstas' : 'Top categorias'}
              </p>
              <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3 py-1">
                {displayTopCats.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-fg2">{c.name}</span>
                    <Num cents={c.totalCents} currency={primary} className="font-semibold text-fg1" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {openDebts.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">Dívidas abertas</p>
              <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3 py-1">
                {openDebts.map((d) => {
                  const paidThis = debtPaymentsByDebtId[d.id] ?? 0;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-fg2">{d.title}</span>
                        {paidThis > 0 && (
                          <span className="mono text-[10px] text-fg4">
                            pago este mês: <Num cents={paidThis} currency={d.currency} className="text-fg3" />
                          </span>
                        )}
                      </div>
                      <Num
                        cents={d.remaining_amount_cents}
                        currency={d.currency}
                        className="shrink-0 font-semibold text-fg1"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {accounts.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">Saldo total das contas</p>
              <div className="flex items-baseline justify-between rounded-md border border-border-soft bg-bg-surface px-4 py-3.5">
                <span className="text-[13px] text-fg3">
                  somando todas as contas
                  {hasBothCurrencies && ` em ${primary}`}
                </span>
                <Num
                  cents={accountsTotalInPrimary.cents}
                  currency={primary}
                  className="text-[18px] font-semibold text-fg1"
                />
              </div>
              {accountsTotalInPrimary.fxIncomplete && (
                <p className="px-1 text-[11px] text-money-negative">
                  fx indisponível — contas em outra moeda não foram somadas
                </p>
              )}
            </section>
          )}

          <SharePngActions text={summaryText} monthIso={monthIso} moeda={primary} />
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  currency: Currency;
  tone: 'positive' | 'negative';
}) {
  const color = tone === 'positive' ? 'text-money-positive' : 'text-money-negative';
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border-soft bg-bg-surface p-3.5">
      <p className="mono truncate text-[10px] uppercase tracking-wider text-fg4">{label}</p>
      <Num
        cents={cents}
        currency={currency}
        className={`mt-1.5 block text-[17px] sm:text-[20px] font-semibold ${color}`}
      />
    </div>
  );
}

function EmptyHero({ isPast }: { isPast: boolean }) {
  if (isPast) {
    return (
      <div className="rounded-md border border-border-soft bg-bg-surface p-8 text-center text-sm text-fg3">
        Sem dados pro mês selecionado.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-border-soft bg-bg-surface p-8 text-center">
      <div className="space-y-2">
        <h2>Sem dados pra resumir.</h2>
        <p className="text-sm text-fg3">
          Lance a primeira despesa pra começar a fechar o mês.
        </p>
      </div>
      <Link
        href="/lancar"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-4" strokeWidth={1.6} aria-hidden />
        Lançar primeira despesa
      </Link>
    </div>
  );
}
