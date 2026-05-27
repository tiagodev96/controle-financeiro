'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Num, type Currency } from '@/components/finance/num';
import { RegisterPaymentDialog } from '@/components/finance/debts/register-payment-dialog';

type Account = { id: string; name: string; currency: Currency };

type Props = {
  debtId: string;
  debtTitle: string;
  debtCurrency: Currency;
  debtRemainingCents: number;
  suggestedCents: number;
  percOfDebt: number;
  sobraEurCents: number;
  accounts: Account[];
};

export function DebtSuggestionCard({
  debtId,
  debtTitle,
  debtCurrency,
  debtRemainingCents,
  suggestedCents,
  percOfDebt,
  sobraEurCents,
  accounts,
}: Props) {
  const [open, setOpen] = useState(false);
  const percLabel = Math.round(percOfDebt * 100);

  return (
    <section className="rounded-md border border-border-soft bg-bg-surface p-4 space-y-3">
      <p className="eyebrow">Sugestão</p>
      <p className="text-[14px] text-fg2">
        Sua sobra prevista é{' '}
        <Num cents={sobraEurCents} currency="EUR" className="font-semibold text-fg1" />.
        {' '}Considere pagar{' '}
        <Num cents={suggestedCents} currency={debtCurrency} className="font-semibold text-fg1" />
        {' '}em <span className="font-semibold text-fg1">{debtTitle}</span>.
      </p>
      <p className="mono text-[10px] text-fg4">
        {percLabel}% da dívida (restante{' '}
        <Num cents={debtRemainingCents} currency={debtCurrency} className="text-fg3" />)
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Wallet className="size-3.5" strokeWidth={1.8} aria-hidden />
        Registrar pagamento
      </button>

      {open && (
        <RegisterPaymentDialog
          debtId={debtId}
          debtTitle={debtTitle}
          remainingCents={debtRemainingCents}
          currency={debtCurrency}
          accounts={accounts}
          open={open}
          onOpenChange={setOpen}
          initialValueCents={suggestedCents}
        />
      )}
    </section>
  );
}
