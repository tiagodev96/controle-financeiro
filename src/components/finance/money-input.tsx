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
      <span className="caption text-fg3">{label}</span>
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
          'block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-base text-fg1 placeholder:text-fg4 font-numeric tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
          className,
        )}
      />
    </label>
  );
}
