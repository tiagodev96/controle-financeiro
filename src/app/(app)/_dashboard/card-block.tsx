import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { Num } from '@/components/finance/num';
import { getDashboardSupabase } from '@/lib/finance/dashboard-data';
import {
  listCreditCardsForHousehold,
  listInvoicesForCard,
} from '@/lib/finance/credit-cards';
import { toLocalIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export async function CardBlock({ nowIso }: { nowIso: string }) {
  const session = await getSession();
  const supabase = await getDashboardSupabase();

  const cards = (await listCreditCardsForHousehold(supabase, session.householdId)).filter(
    (c) => !c.is_archived,
  );
  if (cards.length === 0) return null;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, currency');
  const currencyByAccountId = new Map((accounts ?? []).map((a) => [a.id, a.currency]));

  const todayIso = toLocalIsoDate(new Date(nowIso));

  const sections = await Promise.all(
    cards.map(async (card) => {
      const invoices = await listInvoicesForCard(supabase, {
        cardId: card.id,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        todayIso,
      });
      const openInvoice = invoices.find((i) => i.state === 'open');
      const closedPendingCents = invoices
        .filter((i) => i.state === 'closed')
        .reduce((sum, i) => sum + i.pendingCents, 0);
      const closedNext = invoices.find((i) => i.state === 'closed');
      const committedCents = invoices
        .filter((i) => i.state === 'future')
        .reduce((sum, i) => sum + i.pendingCents, 0);
      const totalPendingCents = invoices.reduce((sum, i) => sum + i.pendingCents, 0);
      return {
        card,
        currency: (currencyByAccountId.get(card.payment_account_id) ?? 'BRL') as 'EUR' | 'BRL',
        openInvoice,
        closedPendingCents,
        closedNext,
        committedCents,
        limitAvailableCents:
          card.credit_limit_cents !== null ? card.credit_limit_cents - totalPendingCents : null,
      };
    }),
  );

  return (
    <section className="space-y-3" data-testid="dashboard-card-block">
      <header className="flex items-baseline justify-between">
        <h2 className="text-fg3">Cartões</h2>
        <Link
          href="/cartoes"
          className="mono text-[10px] text-fg4 underline-offset-2 hover:text-fg1 hover:underline"
        >
          ver tudo
        </Link>
      </header>

      {sections.map(({ card, currency, openInvoice, closedPendingCents, closedNext, committedCents, limitAvailableCents }) => (
        <div
          key={card.id}
          className="rounded-md border border-border-soft bg-bg-surface p-4 space-y-3"
        >
          <p className="text-sm font-medium text-fg1">{card.name}</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="eyebrow">Fatura aberta</p>
              <Num
                cents={openInvoice?.pendingCents ?? 0}
                currency={currency}
                className="text-[17px] font-semibold text-fg1"
              />
              {openInvoice && (
                <p className="mono text-[10px] text-fg4">fecha {shortDate(openInvoice.closesOn)}</p>
              )}
            </div>
            <div>
              <p className="eyebrow">A pagar</p>
              <Num
                cents={closedPendingCents}
                currency={currency}
                className={cn(
                  'text-[17px] font-semibold',
                  closedPendingCents > 0 ? 'text-money-negative' : 'text-fg1',
                )}
              />
              {closedNext && (
                <p
                  className={cn(
                    'mono text-[10px]',
                    closedNext.dueOn < todayIso ? 'text-status-overdue-fg' : 'text-fg4',
                  )}
                >
                  {closedNext.dueOn < todayIso
                    ? 'em atraso'
                    : `vence ${shortDate(closedNext.dueOn)}`}
                </p>
              )}
            </div>
            <div>
              <p className="eyebrow">Comprometido</p>
              <Num
                cents={committedCents}
                currency={currency}
                className="text-[17px] font-semibold text-fg1"
              />
              <p className="mono text-[10px] text-fg4">próximos meses</p>
            </div>
          </div>
          {limitAvailableCents !== null && (
            <p className="mono text-[10px] text-fg4">
              limite disponível:{' '}
              <Num
                cents={limitAvailableCents}
                currency={currency}
                className={cn(
                  'text-[10px] font-semibold',
                  limitAvailableCents < 0 ? 'text-money-negative' : 'text-fg2',
                )}
              />
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
