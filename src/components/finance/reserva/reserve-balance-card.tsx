'use client';

import { useState } from 'react';
import { MinusCircle, PlusCircle } from 'lucide-react';
import { Num, type Currency } from '@/components/finance/num';
import { CCY } from '@/components/finance/ccy';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { MoveEnvelopeDialog } from '@/components/finance/envelopes/move-dialog';

type ReserveSubAccount = {
  id: string;
  name: string;
  currency: Currency;
  currentCents: number;
};

type Props = {
  reserves: ReserveSubAccount[];
  displayCurrency: Currency;
  consolidatedCents: number;
  showToggle: boolean;
};

const ROW_ORDER: Currency[] = ['EUR', 'BRL'];

export function ReserveBalanceCard({
  reserves,
  displayCurrency,
  consolidatedCents,
  showToggle,
}: Props) {
  const ordered = ROW_ORDER.map((c) => reserves.find((r) => r.currency === c)).filter(
    (r): r is ReserveSubAccount => r != null,
  );

  return (
    <div className="rounded-md border border-border-soft bg-bg-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] text-fg3">Reserva guardada</p>
        {showToggle && <CurrencyToggle current={displayCurrency} />}
      </div>

      <Num cents={consolidatedCents} currency={displayCurrency} className="num--stat" />

      <div className="space-y-2 pt-1">
        {ordered.map((reserve) => (
          <ReserveSubAccountRow key={reserve.id} reserve={reserve} />
        ))}
      </div>

      <p className="border-t border-border-soft pt-3 text-[12px] text-fg3">
        Uma subconta por moeda, com nome fixo. Aloque ou devolva saldo direto aqui.
      </p>
    </div>
  );
}

function ReserveSubAccountRow({ reserve }: { reserve: ReserveSubAccount }) {
  const [moveMode, setMoveMode] = useState<'allocate' | 'withdraw' | null>(null);

  return (
    <div className="flex items-center gap-2">
      <CCY code={reserve.currency} />
      <Num
        cents={reserve.currentCents}
        currency={reserve.currency}
        className="text-[13px] font-semibold text-fg2"
      />

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMoveMode('allocate')}
          aria-label={`Alocar em ${reserve.name}`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border-soft bg-bg-inset px-2.5 text-[12px] font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1"
        >
          <PlusCircle className="size-3.5" strokeWidth={1.6} aria-hidden />
          Alocar
        </button>
        <button
          type="button"
          onClick={() => setMoveMode('withdraw')}
          disabled={reserve.currentCents === 0}
          aria-label={`Devolver de ${reserve.name}`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border-soft bg-bg-inset px-2.5 text-[12px] font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1 disabled:opacity-60"
        >
          <MinusCircle className="size-3.5" strokeWidth={1.6} aria-hidden />
          Devolver
        </button>
      </div>

      {moveMode !== null && (
        <MoveEnvelopeDialog
          envelopeId={reserve.id}
          envelopeName={reserve.name}
          currentCents={reserve.currentCents}
          currency={reserve.currency}
          mode={moveMode}
          open={moveMode !== null}
          onOpenChange={(next) => !next && setMoveMode(null)}
        />
      )}
    </div>
  );
}
