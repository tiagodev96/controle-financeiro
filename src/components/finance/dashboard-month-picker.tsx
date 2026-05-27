'use client';

import { useRouter } from 'next/navigation';
import { MonthInput } from './month-input';

type Props = {
  /** YYYY-MM atualmente em uso. */
  value: string;
  /** YYYY-MM do mês corrente (default). Usado pra detectar "hoje". */
  currentMonth: string;
  /** Base da URL (ex: '/', '/resumo'). Default '/'. */
  basePath?: string;
  /** Outros search params a preservar entre navegações (ex: { moeda: 'brl' }). */
  preservedQuery?: Record<string, string>;
};

function buildUrl(
  basePath: string,
  mes: string,
  currentMonth: string,
  preserved: Record<string, string>,
): string {
  const parts: string[] = [];
  if (mes !== currentMonth) parts.push(`mes=${mes}`);
  for (const [k, v] of Object.entries(preserved)) {
    parts.push(`${k}=${v}`);
  }
  return parts.length === 0 ? basePath : `${basePath}?${parts.join('&')}`;
}

/**
 * Picker de mês reusável. Recebe primitivas (basePath + preservedQuery)
 * porque funções não podem cruzar a fronteira server→client component.
 */
export function MonthPicker({
  value,
  currentMonth,
  basePath = '/',
  preservedQuery = {},
}: Props) {
  const router = useRouter();
  const isPast = value !== currentMonth;

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-40 sm:w-44">
        <MonthInput
          value={value}
          onChange={(next) =>
            router.push(buildUrl(basePath, next, currentMonth, preservedQuery))
          }
        />
      </div>
      {isPast && (
        <button
          type="button"
          onClick={() =>
            router.push(buildUrl(basePath, currentMonth, currentMonth, preservedQuery))
          }
          className="mono inline-flex h-9 shrink-0 items-center rounded-md border border-border-soft bg-bg-inset px-2 text-[10px] uppercase tracking-wider text-fg3 hover:text-fg1"
        >
          hoje
        </button>
      )}
    </div>
  );
}

/**
 * @deprecated use MonthPicker direto com basePath/preservedQuery.
 * Mantido por compat enquanto o dashboard migra.
 */
export function DashboardMonthPicker({ value, currentMonth }: { value: string; currentMonth: string }) {
  return <MonthPicker value={value} currentMonth={currentMonth} basePath="/" />;
}
