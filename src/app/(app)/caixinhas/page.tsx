import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { listAllEnvelopesForHousehold, type Envelope } from '@/lib/finance/envelopes';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CreateEnvelopeDialog } from '@/components/finance/envelopes/create-dialog';
import { EnvelopeListItem } from '@/components/finance/envelopes/list-item';
import { Num, type Currency } from '@/components/finance/num';
import { CCY } from '@/components/finance/ccy';

export default async function CaixinhasPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const [envelopes, accounts] = await Promise.all([
    listAllEnvelopesForHousehold(supabase, session.householdId),
    listAllAccountsForHousehold(supabase, session.householdId),
  ]);

  const balanceByCurrency = accounts
    .filter((a) => !a.is_archived)
    .reduce<Record<Currency, number>>(
      (acc, a) => {
        acc[a.currency] = (acc[a.currency] ?? 0) + a.balance_cents;
        return acc;
      },
      { EUR: 0, BRL: 0 },
    );

  const allocatedByCurrency: Record<Currency, number> = { EUR: 0, BRL: 0 };
  for (const e of envelopes) {
    allocatedByCurrency[e.currency] += e.current_cents;
  }

  const eurEnvelopes = envelopes.filter((e) => e.currency === 'EUR');
  const brlEnvelopes = envelopes.filter((e) => e.currency === 'BRL');

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={`${envelopes.length} caixinhas`}
        title="Caixinhas"
        trailing={<CreateEnvelopeDialog />}
      />

      {envelopes.length === 0 ? (
        <p className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
          Sem caixinhas ainda. Crie a primeira pra dividir seu saldo em “potes mentais”.
        </p>
      ) : (
        <>
          {(['EUR', 'BRL'] as const).map((currency) => {
            const list = currency === 'EUR' ? eurEnvelopes : brlEnvelopes;
            if (list.length === 0) return null;
            return (
              <CurrencyGroup
                key={currency}
                currency={currency}
                envelopes={list}
                balanceCents={balanceByCurrency[currency]}
                allocatedCents={allocatedByCurrency[currency]}
              />
            );
          })}
        </>
      )}
    </section>
  );
}

function CurrencyGroup({
  currency,
  envelopes,
  balanceCents,
  allocatedCents,
}: {
  currency: Currency;
  envelopes: Envelope[];
  balanceCents: number;
  allocatedCents: number;
}) {
  const freeCents = balanceCents - allocatedCents;
  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <CCY code={currency} />
          <p className="eyebrow">{envelopes.length} caixinhas</p>
        </div>
        <div className="flex items-baseline gap-2 text-[12px] text-fg4">
          <span>livre</span>
          <Num
            cents={freeCents}
            currency={currency}
            className={
              freeCents < 0
                ? 'text-[14px] font-semibold text-money-negative'
                : 'text-[14px] font-semibold text-fg2'
            }
          />
          <span className="text-fg5">·</span>
          <span>alocado</span>
          <Num cents={allocatedCents} currency={currency} className="text-fg3" />
        </div>
      </header>
      <div className="space-y-2">
        {envelopes.map((e) => (
          <EnvelopeListItem
            key={e.id}
            id={e.id}
            name={e.name}
            currency={e.currency}
            currentCents={e.current_cents}
            targetCents={e.target_cents}
            monthlyContributionCents={e.monthly_contribution_cents}
            isReserve={e.is_reserve}
          />
        ))}
      </div>
    </section>
  );
}
