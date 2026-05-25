'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Direction = 'expense' | 'income';

type Props = {
  value: Direction;
};

/**
 * Segmented toggle Despesa/Entrada. Navega via searchParam (?direction=)
 * pra que a server page re-fetche categorias do kind correto.
 */
export function DirectionToggle({ value }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setDirection(next: Direction) {
    if (next === value) return;
    const sp = new URLSearchParams(params.toString());
    if (next === 'expense') sp.delete('direction');
    else sp.set('direction', 'income');
    router.push(`/lancar${sp.toString() ? `?${sp}` : ''}`);
  }

  return (
    <div
      role="tablist"
      aria-label="Tipo de lançamento"
      className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1"
    >
      <Segment
        active={value === 'expense'}
        onClick={() => setDirection('expense')}
        Icon={ArrowDown}
        label="Despesa"
      />
      <Segment
        active={value === 'income'}
        onClick={() => setDirection('income')}
        Icon={ArrowUp}
        label="Entrada"
      />
    </div>
  );
}

function Segment({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof ArrowDown;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-colors',
        active
          ? 'bg-bg-surface text-fg1 shadow-sm'
          : 'text-fg3 hover:text-fg1',
      )}
    >
      <Icon className="size-3.5" strokeWidth={active ? 1.9 : 1.6} aria-hidden />
      {label}
    </button>
  );
}
