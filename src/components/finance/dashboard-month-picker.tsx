'use client';

import { useRouter } from 'next/navigation';
import { MonthInput } from './month-input';

type Props = {
  /** YYYY-MM atualmente em uso. */
  value: string;
  /** YYYY-MM do mês corrente (default). Usado pra detectar quando estamos no "hoje". */
  currentMonth: string;
  /** Resolve a URL pra um mês escolhido. Permite preservar outros search params. */
  buildUrl: (nextMes: string) => string;
  /** URL do "hoje". Default = buildUrl(currentMonth). */
  todayUrl?: string;
};

/**
 * Picker de mês reusável: usa MonthInput + um botão "hoje" quando o valor não
 * é o mês corrente. Controle da URL final fica com o caller via `buildUrl`,
 * pra preservar params extras (ex: moeda no /resumo).
 */
export function MonthPicker({ value, currentMonth, buildUrl, todayUrl }: Props) {
  const router = useRouter();
  const isPast = value !== currentMonth;
  const resetTarget = todayUrl ?? buildUrl(currentMonth);

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-44">
        <MonthInput value={value} onChange={(next) => router.push(buildUrl(next))} />
      </div>
      {isPast && (
        <button
          type="button"
          onClick={() => router.push(resetTarget)}
          className="mono inline-flex h-9 shrink-0 items-center rounded-md border border-border-soft bg-bg-inset px-2 text-[10px] uppercase tracking-wider text-fg3 hover:text-fg1"
        >
          hoje
        </button>
      )}
    </div>
  );
}

/**
 * @deprecated use MonthPicker direto com `buildUrl`.
 * Mantido por compat enquanto outras telas migram.
 */
export function DashboardMonthPicker({ value, currentMonth }: { value: string; currentMonth: string }) {
  return (
    <MonthPicker
      value={value}
      currentMonth={currentMonth}
      buildUrl={(m) => (m === currentMonth ? '/' : `/?mes=${m}`)}
    />
  );
}
