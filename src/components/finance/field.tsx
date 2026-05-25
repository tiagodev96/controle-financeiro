import { cn } from '@/lib/utils';

type Props = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Field — mini-card ledger com eyebrow + conteúdo. Usado pra Conta/Data
 * inline e outras key-value displays compactos.
 */
export function Field({ label, children, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5',
        className,
      )}
    >
      <span className="eyebrow text-[10px]">{label}</span>
      <div className="text-sm font-medium text-fg1">{children}</div>
    </div>
  );
}
