'use client';

import { createElement } from 'react';
import { ICON_CHOICES } from '@/lib/finance/category-icons';
import { cn } from '@/lib/utils';

type Props = {
  /** Chave do ícone escolhido (string) ou null pra usar heurística por nome. */
  value: string | null;
  onChange: (key: string | null) => void;
};

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Ícone</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mono text-[10px] uppercase tracking-wider text-fg4 hover:text-fg2"
          >
            usar heurística
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5 rounded-md border border-border-soft bg-bg-inset p-2">
        {ICON_CHOICES.map(({ key, Icon, label }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(active ? null : key)}
              aria-label={label}
              aria-pressed={active}
              title={label}
              className={cn(
                'inline-flex aspect-square items-center justify-center rounded-sm border transition-colors',
                active
                  ? 'border-brand/40 bg-brand-quiet-bg text-brand-quiet-fg'
                  : 'border-transparent text-fg3 hover:border-border-soft hover:bg-bg-surface hover:text-fg1',
              )}
            >
              {createElement(Icon, {
                className: 'size-4',
                strokeWidth: active ? 1.9 : 1.6,
                'aria-hidden': true,
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
