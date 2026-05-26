'use client';

import { useRouter } from 'next/navigation';
import { MonthInput } from './month-input';

type Props = {
  /** YYYY-MM atualmente em uso. */
  value: string;
  /** YYYY-MM do mês corrente (default). Vazio = não mostra "Voltar". */
  currentMonth: string;
};

export function DashboardMonthPicker({ value, currentMonth }: Props) {
  const router = useRouter();
  const isPast = value !== currentMonth;

  function setMonth(next: string) {
    const target = next === currentMonth ? '/' : `/?mes=${next}`;
    router.push(target);
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-44">
        <MonthInput value={value} onChange={setMonth} />
      </div>
      {isPast && (
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mono inline-flex h-9 shrink-0 items-center rounded-md border border-border-soft bg-bg-inset px-2 text-[10px] uppercase tracking-wider text-fg3 hover:text-fg1"
        >
          hoje
        </button>
      )}
    </div>
  );
}
