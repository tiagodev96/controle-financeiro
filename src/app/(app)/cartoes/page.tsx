import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { Num } from '@/components/finance/num';
import { StatusPill } from '@/components/finance/status-pill';
import { CreateCreditCardDialog } from '@/components/finance/credit-cards/create-dialog';
import { EditCreditCardDialog } from '@/components/finance/credit-cards/edit-dialog';
import { PayInvoiceDialog } from '@/components/finance/credit-cards/pay-invoice-dialog';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { listAllCategoriesForHousehold } from '@/lib/finance/categories';
import {
  listCreditCardsForHousehold,
  listInvoicesForCard,
  listPurchasesForInvoice,
  type CardInvoice,
  type CardPurchaseRow,
  type CreditCardFull,
} from '@/lib/finance/credit-cards';
import { bestPurchaseDay } from '@/lib/finance/credit-card';
import { toLocalIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

const INVOICES_SHOWN = 6;

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const STATE_LABEL: Record<CardInvoice['state'], string> = {
  open: 'aberta',
  closed: 'fechada',
  paid: 'paga',
  future: 'futura',
};

export default async function CartoesPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const [cards, allAccounts, allCategories] = await Promise.all([
    listCreditCardsForHousehold(supabase, session.householdId),
    listAllAccountsForHousehold(supabase, session.householdId),
    listAllCategoriesForHousehold(supabase, session.householdId),
  ]);

  const accounts = allAccounts
    .filter((a) => !a.is_archived)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  const currencyByAccountId = new Map(allAccounts.map((a) => [a.id, a.currency]));
  const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));

  const active = cards.filter((c) => !c.is_archived);
  const archived = cards.filter((c) => c.is_archived);
  const todayIso = toLocalIsoDate(new Date());

  const eyebrow =
    cards.length === 0
      ? 'nenhum cadastrado'
      : `${active.length} ${active.length === 1 ? 'cartão' : 'cartões'}${archived.length > 0 ? ` · ${archived.length} arquivado${archived.length === 1 ? '' : 's'}` : ''}`;

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={eyebrow}
        title="Cartões"
        trailing={<CreateCreditCardDialog accounts={accounts} />}
      />

      {cards.length === 0 ? (
        <p className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
          Sem cartões cadastrados. Crie o primeiro pra lançar compras no crédito.
        </p>
      ) : (
        <>
          {active.map((card) => (
            <CardSection
              key={card.id}
              card={card}
              currency={currencyByAccountId.get(card.payment_account_id) ?? 'BRL'}
              accounts={accounts}
              categoryNameById={categoryNameById}
              todayIso={todayIso}
            />
          ))}
          {archived.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">Arquivados</p>
              {archived.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-md border border-border-soft bg-bg-surface px-4 py-3"
                >
                  <p className="text-sm text-fg3">{card.name}</p>
                  <EditCreditCardDialog
                    cardId={card.id}
                    name={card.name}
                    closingDay={card.closing_day}
                    dueDay={card.due_day}
                    creditLimitCents={card.credit_limit_cents}
                    paymentAccountId={card.payment_account_id}
                    isArchived={card.is_archived}
                    accounts={accounts}
                  />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}

async function CardSection({
  card,
  currency,
  accounts,
  categoryNameById,
  todayIso,
}: {
  card: CreditCardFull;
  currency: 'EUR' | 'BRL';
  accounts: { id: string; name: string; currency: 'EUR' | 'BRL' }[];
  categoryNameById: Map<string, string>;
  todayIso: string;
}) {
  const supabase = await getServerSupabase();
  const invoices = await listInvoicesForCard(supabase, {
    cardId: card.id,
    closingDay: card.closing_day,
    dueDay: card.due_day,
    todayIso,
  });

  const openInvoice = invoices.find((i) => i.state === 'open');
  const closedUnpaid = invoices.filter((i) => i.state === 'closed');
  const committedCents = invoices
    .filter((i) => i.state === 'future')
    .reduce((sum, i) => sum + i.pendingCents, 0);
  const totalPendingCents = invoices.reduce((sum, i) => sum + i.pendingCents, 0);
  const limitAvailableCents =
    card.credit_limit_cents !== null ? card.credit_limit_cents - totalPendingCents : null;

  const shown = invoices.slice(-INVOICES_SHOWN).reverse();
  const purchasesByInvoice = new Map<string, CardPurchaseRow[]>();
  for (const invoice of shown) {
    purchasesByInvoice.set(
      invoice.dueOn,
      await listPurchasesForInvoice(supabase, { cardId: card.id, dueOn: invoice.dueOn }),
    );
  }

  return (
    <section className="space-y-3" data-testid={`card-section-${card.id}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-fg1">{card.name}</h2>
          <p className="mono text-[10px] text-fg4">
            fecha dia {card.closing_day} · vence dia {card.due_day} · melhor dia pra comprar:{' '}
            {bestPurchaseDay(card.closing_day)}
          </p>
        </div>
        <EditCreditCardDialog
          cardId={card.id}
          name={card.name}
          closingDay={card.closing_day}
          dueDay={card.due_day}
          creditLimitCents={card.credit_limit_cents}
          paymentAccountId={card.payment_account_id}
          isArchived={card.is_archived}
          accounts={accounts}
        />
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border-soft bg-bg-surface p-4">
          <p className="eyebrow">Fatura aberta</p>
          <Num
            cents={openInvoice?.pendingCents ?? 0}
            currency={currency}
            className="num--stat text-fg1"
          />
          {openInvoice && (
            <p className="mono text-[10px] text-fg4">
              fecha {shortDate(openInvoice.closesOn)} · vence {shortDate(openInvoice.dueOn)}
            </p>
          )}
        </div>
        <div className="rounded-md border border-border-soft bg-bg-surface p-4">
          <p className="eyebrow">Comprometido</p>
          <Num cents={committedCents} currency={currency} className="num--stat text-fg1" />
          <p className="mono text-[10px] text-fg4">parcelas após a próxima fatura</p>
        </div>
      </div>

      {limitAvailableCents !== null && (
        <p className="mono px-1 text-[11px] text-fg4">
          Limite disponível:{' '}
          <Num
            cents={limitAvailableCents}
            currency={currency}
            className={cn(
              'text-[11px] font-semibold',
              limitAvailableCents < 0 ? 'text-money-negative' : 'text-fg2',
            )}
          />
        </p>
      )}

      {closedUnpaid.map((invoice) => (
        <div
          key={invoice.dueOn}
          data-testid={`invoice-due-${invoice.dueOn}`}
          className="flex items-center justify-between gap-3 rounded-md border border-status-overdue-fg/30 bg-bg-surface px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-fg1">
              Fatura {shortDate(invoice.dueOn)}
              {invoice.dueOn < todayIso && (
                <span className="ml-2 mono text-[10px] uppercase tracking-wider text-status-overdue-fg">
                  em atraso
                </span>
              )}
            </p>
            <Num
              cents={invoice.pendingCents}
              currency={currency}
              className="text-[15px] font-semibold text-fg1"
            />
          </div>
          <PayInvoiceDialog
            cardId={card.id}
            cardName={card.name}
            dueOn={invoice.dueOn}
            totalPendingCents={invoice.pendingCents}
            currency={currency}
            paymentAccountId={card.payment_account_id}
            accounts={accounts}
          />
        </div>
      ))}

      {shown.length > 0 && (
        <div className="space-y-3">
          {shown.map((invoice) => (
            <details
              key={invoice.dueOn}
              open={invoice.state === 'open' || invoice.state === 'closed'}
              className="rounded-md border border-border-soft bg-bg-surface"
            >
              <summary className="flex cursor-pointer select-none items-baseline justify-between gap-2 px-4 py-3">
                <span className="text-sm font-medium text-fg1">
                  Fatura {shortDate(invoice.dueOn)}
                  <span className="ml-2 mono text-[10px] uppercase tracking-wider text-fg4">
                    {STATE_LABEL[invoice.state]}
                  </span>
                </span>
                <Num
                  cents={invoice.totalCents}
                  currency={currency}
                  className="text-[14px] font-semibold text-fg2"
                />
              </summary>
              <div className="divide-y divide-border-soft border-t border-border-soft px-4">
                {(purchasesByInvoice.get(invoice.dueOn) ?? []).map((purchase) => (
                  <PurchaseRow
                    key={purchase.id}
                    purchase={purchase}
                    currency={currency}
                    categoryName={
                      purchase.category_id
                        ? (categoryNameById.get(purchase.category_id) ?? '—')
                        : '—'
                    }
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      <p className="px-1">
        <Link
          href={`/transacoes?cartao=${card.id}&mes=all`}
          className="mono text-[11px] text-fg3 underline-offset-2 hover:text-fg1 hover:underline"
        >
          Ver tudo em transações
        </Link>
      </p>
    </section>
  );
}

function PurchaseRow({
  purchase,
  currency,
  categoryName,
}: {
  purchase: CardPurchaseRow;
  currency: 'EUR' | 'BRL';
  categoryName: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15px] text-fg1">{purchase.description}</p>
        <div className="flex items-center gap-2 text-xs text-fg3">
          <span className="truncate">{categoryName}</span>
          {purchase.purchased_on && (
            <span className="mono text-[10px] text-fg4">
              compra {shortDate(purchase.purchased_on)}
            </span>
          )}
          <StatusPill status={purchase.status} />
        </div>
      </div>
      <Num
        cents={purchase.amount_cents}
        currency={currency}
        className="shrink-0 text-[15px] font-semibold text-money-negative"
      />
    </div>
  );
}
