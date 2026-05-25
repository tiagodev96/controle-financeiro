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
    <label htmlFor={id} className="block space-y-1.5">
      <span className="caption">{label}</span>
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
          'num-lg block w-full rounded-md border border-border bg-surface-input px-3 py-3 text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      />
    </label>
  );
}
