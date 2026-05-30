import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import { FxUnavailableError, getRateMap, type RateMap } from '@/lib/fx';
import { AppTopBar } from '@/components/finance/app-top-bar';
import {
  loadMonthlyEssential,
  loadReservaAllocatedCents,
} from '@/lib/finance/reserva-data';
import {
  ensureReserveEnvelopes,
  loadReserveEnvelopes,
} from '@/lib/finance/reserva-envelopes';
import { bandForMonths, monthsCovered } from '@/lib/finance/reserva';
import { ReservaHealthGauge } from '@/components/finance/reserva/health-gauge';
import { ReserveBalanceCard } from '@/components/finance/reserva/reserve-balance-card';
import { EssentialCategoriesEditor } from '@/components/finance/reserva/essential-categories';
import type { Currency } from '@/components/finance/num';

export default async function ReservaPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const targetCurrency = session.preferredDisplayCurrency;

  const { data: accountRows } = await supabase
    .from('accounts')
    .select('currency')
    .eq('is_archived', false);
  const currencies = new Set((accountRows ?? []).map((a) => a.currency));
  let fxRateMap: RateMap | null = null;
  if (currencies.has('EUR') && currencies.has('BRL')) {
    try {
      fxRateMap = await getRateMap({
        supabase,
        serviceSupabase: getServiceRoleSupabase(),
      });
    } catch (err) {
      if (!(err instanceof FxUnavailableError)) throw err;
    }
  }

  await ensureReserveEnvelopes(supabase, session.householdId);

  const [essential, allocatedCents, reserves, categoryRows] = await Promise.all([
    loadMonthlyEssential({
      supabase,
      householdId: session.householdId,
      targetCurrency,
      fxRateMap,
      now: new Date(),
    }),
    loadReservaAllocatedCents({
      supabase,
      householdId: session.householdId,
      targetCurrency,
      fxRateMap,
    }),
    loadReserveEnvelopes(supabase, session.householdId),
    supabase
      .from('categories')
      .select('id, name, is_essential')
      .eq('household_id', session.householdId)
      .eq('kind', 'expense')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true }),
  ]);

  const reserveByCurrency: Record<Currency, number> = { EUR: 0, BRL: 0 };
  for (const reserve of reserves) {
    reserveByCurrency[reserve.currency] = reserve.currentCents;
  }

  const covered = monthsCovered(allocatedCents, essential.cents);
  const band = bandForMonths(covered);
  const categories = (categoryRows.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    isEssential: c.is_essential,
  }));

  return (
    <section className="space-y-6">
      <AppTopBar eyebrow="Reserva de emergência" title="Reserva" />

      {essential.cents > 0 ? (
        <ReservaHealthGauge
          band={band}
          monthsCovered={covered}
          monthlyEssentialCents={essential.cents}
          allocatedCents={allocatedCents}
          currency={targetCurrency as Currency}
          variableCalibrating={essential.variableCalibrating}
        />
      ) : (
        <p className="rounded-md border border-border-soft bg-bg-surface p-5 text-sm text-fg3">
          Pra calcular sua reserva ideal, marque abaixo as categorias essenciais (as que você
          não corta numa emergência) e cadastre seus gastos recorrentes.
        </p>
      )}

      <div className="space-y-3">
        <h2>Caixinha de reserva</h2>
        <p className="text-[13px] text-fg3">
          Sua reserva tem uma subconta por moeda. O total consolidado abaixo é o que o gauge
          mede contra o custo essencial.
        </p>
        <ReserveBalanceCard
          byCurrency={reserveByCurrency}
          displayCurrency={targetCurrency as Currency}
          consolidatedCents={allocatedCents}
          showToggle={fxRateMap !== null}
        />
      </div>

      <div className="space-y-3">
        <h2>Categorias essenciais</h2>
        <p className="text-[13px] text-fg3">
          Gastos que não dá pra interromper numa crise (moradia, alimentação, contas). Definem
          o custo mensal que a reserva precisa cobrir.
        </p>
        <EssentialCategoriesEditor categories={categories} />
      </div>
    </section>
  );
}
