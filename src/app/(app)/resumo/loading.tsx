import {
  SkeletonTopBar,
  SkeletonHero,
  SkeletonStatTrio,
  SkeletonCard,
  SkeletonProgressList,
  SkeletonListItem,
  SkeletonLine,
} from '@/components/finance/skeletons';

export default function ResumoLoading() {
  return (
    <section className="space-y-6" aria-busy="true" aria-live="polite">
      <SkeletonTopBar />

      <SkeletonHero />

      <SkeletonStatTrio />

      <section className="space-y-3">
        <SkeletonLine width="w-32" height="h-4" />
        <SkeletonProgressList rows={3} />
      </section>

      <section className="space-y-3">
        <SkeletonLine width="w-28" height="h-4" />
        <div className="space-y-2">
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      </section>

      <SkeletonCard height="h-20" />
    </section>
  );
}
