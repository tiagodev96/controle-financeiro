import {
  SkeletonHero,
  SkeletonStatTrio,
  SkeletonCard,
  SkeletonTxnGroup,
  SkeletonProgressList,
  SkeletonLine,
} from '@/components/finance/skeletons';

export function HeroBlockSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <SkeletonHero />
        <SkeletonCard height="h-44" />
      </section>
      <SkeletonStatTrio />
    </div>
  );
}

export function InsightsBlockSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonCard height="h-24" />
      <SkeletonCard height="h-28" />
    </div>
  );
}

export function FxBlockSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <SkeletonLine width="w-16" height="h-4" />
        <SkeletonLine width="w-16" height="h-2.5" />
      </div>
      <SkeletonCard height="h-60" />
      <SkeletonCard height="h-32" />
    </div>
  );
}

export function BottomBlockSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SkeletonLine width="w-24" height="h-4" />
          <SkeletonLine width="w-10" height="h-2.5" />
        </div>
        <SkeletonProgressList rows={4} />
      </section>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <SkeletonLine width="w-32" height="h-4" />
          <SkeletonLine width="w-14" height="h-2.5" />
        </div>
        <SkeletonTxnGroup rows={3} />
      </section>
    </div>
  );
}
