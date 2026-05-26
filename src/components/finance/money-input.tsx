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
  /**
   * Mostra um botão "±" pra inverter o sinal. Use só onde valores negativos
   * fazem sentido (ex.: editar saldo de conta).
   */
  allowSign?: boolean;
};

const MAX_CENTS = 999_999_999_99;

function appendDigit(current: number, digit: number): number {
  const sign = current < 0 ? -1 : 1;
  const abs = Math.abs(current);
  const next = abs * 10 + digit;
  return sign * Math.min(next, MAX_CENTS);
}

function removeLastDigit(current: number): number {
  const sign = current < 0 ? -1 : 1;
  const abs = Math.abs(current);
  return sign * Math.floor(abs / 10);
}

export function MoneyInput({
  label,
  valueCents,
  onChange,
  autoFocus,
  name,
  className,
  allowSign = false,
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
      <div className="relative">
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
            allowSign && 'pr-14',
            className,
          )}
        />
        {allowSign && (
          <button
            type="button"
            onClick={() => onChange(-valueCents)}
            aria-label={valueCents < 0 ? 'Tornar positivo' : 'Tornar negativo'}
            className="absolute right-2 top-1/2 inline-flex h-8 min-w-10 -translate-y-1/2 items-center justify-center rounded-md border border-border-soft bg-bg-surface px-2 text-sm font-semibold text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ±
          </button>
        )}
      </div>
    </label>
  );
}
