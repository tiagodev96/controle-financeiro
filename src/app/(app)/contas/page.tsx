import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { listAllAccountsForHousehold, type AccountFull } from '@/lib/finance/accounts';
import { listSnapshotsForChart } from '@/lib/finance/balance-trend';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CreateAccountDialog } from '@/components/finance/accounts/create-dialog';
import { AccountListItem } from '@/components/finance/accounts/list-item';
import { BalanceTrendChart } from '@/components/finance/accounts/balance-trend-chart';

export default async function ContasPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const [all, trendEur, trendBrl] = await Promise.all([
    listAllAccountsForHousehold(supabase, session.householdId),
    listSnapshotsForChart(supabase, session.householdId, 'EUR', 26),
    listSnapshotsForChart(supabase, session.householdId, 'BRL', 26),
  ]);
  const active = all.filter((a) => !a.is_archived);
  const archived = all.filter((a) => a.is_archived);
  const hasAnyTrend = trendEur.length > 0 || trendBrl.length > 0;
  const defaultTrendCurrency =
    trendEur.length >= trendBrl.length ? 'EUR' : 'BRL';

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={`${active.length} ativas`}
        title="Contas"
        trailing={<CreateAccountDialog />}
      />

      <Section rows={active} archived={false} />

      {hasAnyTrend && (
        <BalanceTrendChart
          series={{ EUR: trendEur, BRL: trendBrl }}
          defaultCurrency={defaultTrendCurrency}
        />
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <p className="eyebrow px-1">Arquivadas ({archived.length})</p>
          <Section rows={archived} archived />
        </section>
      )}
    </section>
  );
}

function Section({ rows, archived }: { rows: AccountFull[]; archived: boolean }) {
  if (rows.length === 0 && !archived) {
    return (
      <p className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
        Sem contas ainda. Crie a primeira pra começar.
      </p>
    );
  }
  return (
    <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
      {rows.map((a) => (
        <AccountListItem
          key={a.id}
          id={a.id}
          name={a.name}
          currency={a.currency}
          balanceCents={a.balance_cents}
          archived={archived}
        />
      ))}
    </div>
  );
}
