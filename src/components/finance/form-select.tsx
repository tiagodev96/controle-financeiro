'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FormSelectOption = {
  value: string;
  label: string;
  /** Conteúdo extra renderizado antes do label (ex: chip de moeda). */
  prefix?: React.ReactNode;
};

type Props = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  /** Renderiza só o trigger, sem `<label>` wrapper. */
  bare?: boolean;
};

/**
 * Select estilizado com tokens do design system. Substitui `<select>` nativo —
 * mesma API controlada (value + onChange) mas com popover que respeita o
 * tema dark/light e o brand wine.
 */
export function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  ariaLabel,
  triggerClassName,
  bare,
}: Props) {
  const selected = options.find((o) => o.value === value);

  const trigger = (
    <SelectPrimitive.Trigger
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-inset px-3 py-2 text-left text-sm text-fg1 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        triggerClassName,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
        {selected?.prefix}
        <SelectPrimitive.Value placeholder={placeholder} className="truncate">
          {selected ? selected.label : <span className="text-fg4">{placeholder ?? 'Selecionar'}</span>}
        </SelectPrimitive.Value>
      </span>
      <SelectPrimitive.Icon
        render={<ChevronDown className="size-4 shrink-0 text-fg3" strokeWidth={1.6} aria-hidden />}
      />
    </SelectPrimitive.Trigger>
  );

  const popup = (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side="bottom"
        sideOffset={4}
        alignItemWithTrigger={false}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          className={cn(
            'max-h-72 min-w-(--anchor-width) overflow-y-auto rounded-md border border-border-soft bg-bg-raised py-1 text-sm text-fg1 shadow-md',
            'data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
            'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
          )}
        >
          <SelectPrimitive.List>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-fg1 outline-none transition-colors data-[highlighted]:bg-bg-inset data-[selected]:bg-bg-inset data-[selected]:font-semibold"
              >
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex size-4 items-center justify-center">
                  <Check className="size-4 text-brand" strokeWidth={2} aria-hidden />
                </SelectPrimitive.ItemIndicator>
                {option.prefix}
                <SelectPrimitive.ItemText className="flex-1 truncate pr-6">
                  {option.label}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );

  const root = (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(String(next))}
      required={required}
      disabled={disabled}
    >
      {trigger}
      {popup}
    </SelectPrimitive.Root>
  );

  if (bare) return root;

  return (
    <label className="flex flex-col gap-1">
      {label && <span className="eyebrow">{label}</span>}
      {root}
    </label>
  );
}
