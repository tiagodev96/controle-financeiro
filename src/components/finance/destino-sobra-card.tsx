'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wallet, ShieldCheck, ArrowRight } from 'lucide-react';
import { Num, type Currency } from '@/components/finance/num';
import { RegisterPaymentDialog } from '@/components/finance/debts/register-payment-dialog';

type Account = { id: string; name: string; currency: Currency };

type DebtPart = {
  id: string;
  title: string;
  currency: Currency;
  remainingCents: number;
  suggestedCents: number;
  percOfDebt: number;
};

type ReservePart = {
  toReserveCents: number;
  toFreeCents: number;
  mode: 'guardar' | 'investir';
  hasReserveEnvelope: boolean;
};

type Props = {
  sobraEurCents: number;
  debt: DebtPart | null;
  reserve: ReservePart | null;
  accounts: Account[];
};

/**
 * Destino da sobra: como repartir a sobra prevista entre dívida, reserva e
 * livre. A dívida é acionável (registra pagamento); a reserva é um nudge com
 * link pra /reserva. Sem cores money-positive/negative — direção vem do texto.
 */
export function DestinoSobraCard({ sobraEurCents, debt, reserve, accounts }: Props) {
  const [payOpen, setPayOpen] = useState(false);

  return (
    <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
      <p className="eyebrow">Destino da sobra</p>
      <p className="text-[14px] text-fg2">
        Sua sobra prevista é{' '}
        <Num cents={sobraEurCents} currency="EUR" className="font-semibold text-fg1" />.
      </p>

      <div className="divide-y divide-border-soft">
        {debt && (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] text-fg3">Pagar dívida</p>
              <p className="text-[14px] text-fg1">
                <Num cents={debt.suggestedCents} currency={debt.currency} className="font-semibold" />{' '}
                em <span className="font-medium">{debt.title}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Wallet className="size-3.5" strokeWidth={1.8} aria-hidden />
              Pagar
            </button>
          </div>
        )}

        {reserve && reserve.mode === 'guardar' && reserve.toReserveCents > 0 && (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] text-fg3">Guardar na reserva</p>
              <p className="text-[14px] text-fg1">
                <Num cents={reserve.toReserveCents} currency="EUR" className="font-semibold" />
              </p>
            </div>
            <Link
              href="/reserva"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border-soft px-3 text-sm font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1"
            >
              <ShieldCheck className="size-3.5" strokeWidth={1.8} aria-hidden />
              {reserve.hasReserveEnvelope ? 'Reserva' : 'Definir'}
            </Link>
          </div>
        )}

        {reserve && reserve.mode === 'investir' && (
          <div className="py-2.5">
            <p className="text-[13px] text-fg3">Reserva completa</p>
            <p className="text-[14px] text-fg2">
              O excedente pode ir pra investimento de longo prazo.
            </p>
          </div>
        )}

        {reserve && (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <p className="text-[13px] text-fg3">Livre</p>
            <Num cents={reserve.toFreeCents} currency="EUR" className="text-[14px] font-semibold text-fg2" />
          </div>
        )}
      </div>

      {!reserve && debt && (
        <Link
          href="/reserva"
          className="inline-flex items-center gap-1 text-[12px] text-fg4 hover:text-fg2"
        >
          Configurar reserva
          <ArrowRight className="size-3" strokeWidth={1.8} aria-hidden />
        </Link>
      )}

      {debt && payOpen && (
        <RegisterPaymentDialog
          debtId={debt.id}
          debtTitle={debt.title}
          remainingCents={debt.remainingCents}
          currency={debt.currency}
          accounts={accounts}
          open={payOpen}
          onOpenChange={setPayOpen}
          initialValueCents={debt.suggestedCents}
        />
      )}
    </section>
  );
}
