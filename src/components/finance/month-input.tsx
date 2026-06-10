'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONTHS_PT as MONTHS_PT_LONG, MONTHS_PT_SHORT } from '@/lib/dates';

type Props = {
  label?: string;
  /** YYYY-MM ou '' pra placeholder. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function parseValue(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function formatLabel(value: string): string {
  const parsed = parseValue(value);
  if (!parsed) return '';
  return `${MONTHS_PT_LONG[parsed.month - 1]} de ${parsed.year}`;
}

export function MonthInput({ label, value, onChange, disabled, placeholder }: Props) {
  const parsed = parseValue(value);
  const today = new Date();
  const initialYear = parsed?.year ?? today.getFullYear();
  const [open, setOpen] = useState(false);
  const [yearCursor, setYearCursor] = useState(initialYear);

  // Sincroniza yearCursor quando value muda (ex: troca de mês externa).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const reparsed = parseValue(value);
    if (reparsed) setYearCursor(reparsed.year);
  }

  function pickMonth(month: number) {
    const iso = `${yearCursor}-${String(month).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  }

  const trigger = (
    <Popover.Trigger
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-inset px-3 py-2 text-left text-sm text-fg1 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span className={cn('flex min-w-0 flex-1 items-center gap-2 truncate', !value && 'text-fg4')}>
        <Calendar className="size-3.5 shrink-0 text-fg3" strokeWidth={1.6} aria-hidden />
        {value ? formatLabel(value) : (placeholder ?? 'Selecionar mês')}
      </span>
    </Popover.Trigger>
  );

  return (
    <label className="flex flex-col gap-1">
      {label && <span className="eyebrow">{label}</span>}
      <Popover.Root open={open} onOpenChange={setOpen}>
        {trigger}
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
            <Popover.Popup className="w-64 rounded-md border border-border-soft bg-bg-raised p-3 text-sm shadow-md data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95">
              <div className="flex items-center justify-between gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => setYearCursor((y) => y - 1)}
                  aria-label="Ano anterior"
                  className="inline-flex size-7 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-inset hover:text-fg1"
                >
                  <ChevronLeft className="size-4" strokeWidth={1.6} aria-hidden />
                </button>
                <span className="mono text-[13px] font-semibold tabular-nums text-fg1">
                  {yearCursor}
                </span>
                <button
                  type="button"
                  onClick={() => setYearCursor((y) => y + 1)}
                  aria-label="Próximo ano"
                  className="inline-flex size-7 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-inset hover:text-fg1"
                >
                  <ChevronRight className="size-4" strokeWidth={1.6} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MONTHS_PT_SHORT.map((m, idx) => {
                  const monthNum = idx + 1;
                  const isActive = parsed?.year === yearCursor && parsed?.month === monthNum;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => pickMonth(monthNum)}
                      className={cn(
                        'h-9 rounded-md text-[12px] font-medium transition-colors',
                        isActive
                          ? 'bg-brand text-fg-on-brand'
                          : 'text-fg2 hover:bg-bg-inset hover:text-fg1',
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </label>
  );
}
