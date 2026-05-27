import { cn } from '@/lib/utils';

const BASE = 'animate-pulse rounded-sm bg-bg-inset/60';

export function SkeletonLine({
  className,
  width = 'w-24',
  height = 'h-3',
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return <div className={cn(BASE, width, height, className)} aria-hidden />;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn(BASE, className)} aria-hidden />;
}

export function SkeletonTopBar() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pb-2">
      <div className="space-y-2">
        <SkeletonLine width="w-28" height="h-2.5" />
        <SkeletonLine width="w-40" height="h-7" />
      </div>
    </header>
  );
}

export function SkeletonHero() {
  return (
    <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-5 lg:p-6">
      <SkeletonLine width="w-24" height="h-3.5" />
      <div className="flex items-baseline gap-2">
        <SkeletonBlock className="h-9 w-6 sm:h-12 sm:w-8" />
        <SkeletonBlock className="h-11 w-44 sm:h-14 sm:w-56" />
        <SkeletonBlock className="h-6 w-12 sm:h-7 sm:w-14" />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SkeletonLine width="w-16" height="h-2.5" />
        <SkeletonLine width="w-20" height="h-2.5" />
      </div>
    </section>
  );
}

export function SkeletonStatCell() {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
      <SkeletonLine width="w-14" height="h-2.5" />
      <SkeletonLine width="w-20" height="h-5" />
      <SkeletonLine width="w-10" height="h-2" />
    </div>
  );
}

export function SkeletonStatTrio() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SkeletonStatCell />
      <SkeletonStatCell />
      <SkeletonStatCell />
    </div>
  );
}

export function SkeletonCard({
  height = 'h-32',
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border-soft bg-bg-surface p-5 lg:p-6',
        height,
        className,
      )}
      aria-hidden
    >
      <div className="space-y-3">
        <SkeletonLine width="w-32" height="h-3" />
        <SkeletonLine width="w-48" height="h-8" />
        <SkeletonLine width="w-24" height="h-2.5" />
      </div>
    </div>
  );
}

export function SkeletonTxnRow() {
  return (
    <div className="flex items-center gap-3 border-b border-border-soft py-3 last:border-b-0">
      <div className="min-w-0 flex-1 space-y-1.5">
        <SkeletonLine width="w-40" height="h-3.5" />
        <SkeletonLine width="w-20" height="h-2.5" />
      </div>
      <SkeletonLine width="w-20" height="h-3.5" />
    </div>
  );
}

export function SkeletonTxnGroup({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-1.5">
      <SkeletonLine width="w-14" height="h-2.5" className="ml-1" />
      <div className="rounded-md border border-border-soft bg-bg-surface px-3">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTxnRow key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonProgressList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <SkeletonLine width="w-24" height="h-3" />
            <SkeletonLine width="w-16" height="h-3" />
          </div>
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-border-soft bg-bg-surface px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <SkeletonLine width="w-32" height="h-3.5" />
        <SkeletonLine width="w-20" height="h-2.5" />
      </div>
      <SkeletonLine width="w-16" height="h-3.5" />
    </div>
  );
}
