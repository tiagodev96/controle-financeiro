import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

export function EmptyState({ message, ctaLabel, ctaHref, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-md border border-border-soft bg-bg-surface p-6 text-center',
        className,
      )}
    >
      <p className="text-fg3">{message}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
