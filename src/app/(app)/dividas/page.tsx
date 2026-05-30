import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  listDebtsForHousehold,
  debtPaymentPace,
  type DebtRow,
} from '@/lib/finance/debts';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CreateDebtDialog } from '@/components/finance/debts/create-dialog';
import { DebtListItem } from '@/components/finance/debts/list-item';

const MIN_PACE_MONTHS = 2;

export default async function DividasPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const [{ open, closed }, allAccounts] = await Promise.all([
    listDebtsForHousehold(supabase, session.householdId),
    listAllAccountsForHousehold(supabase, session.householdId),
  ]);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const withDeadline = open.filter((d) => d.target_quit_date);
  const paceEntries = await Promise.all(
    withDeadline.map(async (d) => {
      const pace = await debtPaymentPace(supabase, session.householdId, d.id, now);
      const reliable = pace && pace.monthsElapsed >= MIN_PACE_MONTHS;
      return [d.id, reliable ? pace.paceCents : null] as const;
    }),
  );
  const paceMap = new Map(paceEntries);

  const accounts = allAccounts
    .filter((a) => !a.is_archived)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  const eyebrow =
    open.length === 0 && closed.length === 0
      ? 'nada cadastrado'
      : open.length === 0
        ? 'tudo quitado'
        : `${open.length} aberta${open.length === 1 ? '' : 's'}${closed.length > 0 ? ` · ${closed.length} fechada${closed.length === 1 ? '' : 's'}` : ''}`;

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={eyebrow}
        title="Dívidas"
        trailing={<CreateDebtDialog />}
      />

      {open.length === 0 && closed.length === 0 ? (
        <p className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
          Sem dívidas cadastradas. Crie a primeira pra acompanhar o que falta pagar.
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <Section
              label="Abertas"
              debts={open}
              accounts={accounts}
              paceMap={paceMap}
              todayIso={todayIso}
            />
          )}
          {closed.length > 0 && (
            <Section
              label={`Fechadas (${closed.length})`}
              debts={closed}
              accounts={accounts}
              paceMap={paceMap}
              todayIso={todayIso}
            />
          )}
        </>
      )}
    </section>
  );
}

function Section({
  label,
  debts,
  accounts,
  paceMap,
  todayIso,
}: {
  label: string;
  debts: DebtRow[];
  accounts: { id: string; name: string; currency: 'BRL' | 'EUR' }[];
  paceMap: Map<string, number | null>;
  todayIso: string;
}) {
  return (
    <section className="space-y-2">
      <p className="eyebrow px-1">{label}</p>
      <div className="flex flex-col gap-2.5">
        {debts.map((d) => (
          <DebtListItem
            key={d.id}
            id={d.id}
            title={d.title}
            originalCents={d.original_amount_cents}
            remainingCents={d.remaining_amount_cents}
            currency={d.currency}
            priority={d.priority}
            status={d.status}
            notes={d.notes}
            targetQuitDate={d.target_quit_date}
            actualMonthlyCents={paceMap.get(d.id) ?? null}
            todayIso={todayIso}
            accounts={accounts}
          />
        ))}
      </div>
    </section>
  );
}
