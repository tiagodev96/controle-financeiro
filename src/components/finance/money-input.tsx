'use client';

import { useId } from 'react';
import { formatCentsToBRL } from '@/lib/money/format';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  valueCents: number;
  onChange: (cents: number) => void;
  autoFocus?: boolean;
  name?: string;
  className?: string;
};

export function MoneyInput({
  label,
  valueCents,
  onChange,
  autoFocus,
  name,
  className,
}: Props) {
  const id = useId();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/\D/g, '');
    const next = digitsOnly === '' ? 0 : Number.parseInt(digitsOnly, 10);
    if (next !== valueCents) {
      onChange(next);
    }
  }

  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="eyebrow">{label}</span>
      <input
        id={id}
        type="text"
        name={name}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={formatCentsToBRL(valueCents)}
        onChange={handleChange}
        className={cn(
          'num num--stat block w-full rounded-md border border-border bg-bg-inset px-4 py-3 text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      />
    </label>
  );
}
