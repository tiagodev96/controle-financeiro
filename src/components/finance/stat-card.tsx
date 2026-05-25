import { cn } from '@/lib/utils';

type Props = {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  size?: 'stat' | 'hero';
  className?: string;
};

export function StatCard({ label, children, hint, size = 'stat', className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-border-soft bg-bg-surface p-4',
        className,
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className={cn('num text-fg1', size === 'hero' ? 'num--hero' : 'num--stat')}>
        {children}
      </p>
      {hint && <p className="text-sm text-fg3">{hint}</p>}
    </div>
  );
}
