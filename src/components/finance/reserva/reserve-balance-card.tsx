import Link from 'next/link';
import { Num, type Currency } from '@/components/finance/num';
import { CCY } from '@/components/finance/ccy';
import { CurrencyToggle } from '@/components/finance/currency-toggle';

type Props = {
  byCurrency: Record<Currency, number>;
  displayCurrency: Currency;
  consolidatedCents: number;
  showToggle: boolean;
};

export function ReserveBalanceCard({
  byCurrency,
  displayCurrency,
  consolidatedCents,
  showToggle,
}: Props) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] text-fg3">Reserva guardada</p>
        {showToggle && <CurrencyToggle current={displayCurrency} />}
      </div>

      <Num cents={consolidatedCents} currency={displayCurrency} className="num--stat" />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <CCY code="EUR" />
        <Num cents={byCurrency.EUR} currency="EUR" className="text-[11px] text-fg3" />
        <span className="text-fg5">·</span>
        <CCY code="BRL" />
        <Num cents={byCurrency.BRL} currency="BRL" className="text-[11px] text-fg3" />
      </div>

      <p className="border-t border-border-soft pt-3 text-[12px] text-fg3">
        Uma subconta por moeda, não editáveis. Pra abastecer, ajuste o saldo em{' '}
        <Link href="/caixinhas" className="text-brand underline-offset-2 hover:underline">
          Caixinhas
        </Link>
        .
      </p>
    </div>
  );
}
