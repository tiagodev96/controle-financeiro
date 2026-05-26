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

const MAX_CENTS = 999_999_999_99;

function appendDigit(current: number, digit: number): number {
  const next = current * 10 + digit;
  return Math.min(next, MAX_CENTS);
}

function removeLastDigit(current: number): number {
  return Math.floor(current / 10);
}

export function MoneyInput({
  label,
  valueCents,
  onChange,
  autoFocus,
  name,
  className,
}: Props) {
  const id = useId();

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (['Tab', 'Enter', 'Escape'].includes(event.key)) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      onChange(removeLastDigit(valueCents));
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      onChange(appendDigit(valueCents, Number(event.key)));
      return;
    }
    // Bloqueia letras, vírgula, pontos, setas — qualquer edição posicional.
    event.preventDefault();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    const digits = pasted.replace(/\D/g, '');
    if (!digits) return;
    let next = valueCents;
    for (const ch of digits) {
      next = appendDigit(next, Number(ch));
    }
    onChange(next);
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
        onChange={(event) => {
          // Caminho usado por Playwright .fill() e qualquer set programático
          // que dispare onChange sem passar por onKeyDown. Extrai dígitos crus
          // e converte pra centavos. Edição manual nunca cai aqui porque o
          // onKeyDown faz preventDefault antes da mudança nativa.
          const digits = event.target.value.replace(/\D/g, '');
          const next = digits === '' ? 0 : Math.min(Number.parseInt(digits, 10), MAX_CENTS);
          if (next !== valueCents) onChange(next);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(
          'num num--stat block w-full rounded-md border border-border bg-bg-inset px-4 py-3 text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring caret-transparent',
          className,
        )}
      />
    </label>
  );
}
