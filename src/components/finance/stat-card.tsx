import { cn } from '@/lib/utils';

type Props = {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  size?: 'md' | 'lg';
  className?: string;
};

export function StatCard({ label, children, hint, size = 'md', className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-border bg-surface p-4',
        className,
      )}
    >
      <p className="caption">{label}</p>
      <p className={cn(size === 'lg' ? 'num-display' : 'num-lg', 'text-fg')}>
        {children}
      </p>
      {hint && <p className="text-sm text-fg-muted">{hint}</p>}
    </div>
  );
}
