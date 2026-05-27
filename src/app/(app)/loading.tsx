import {
  SkeletonTopBar,
  SkeletonHero,
  SkeletonStatTrio,
  SkeletonCard,
} from '@/components/finance/skeletons';

export default function AppLoading() {
  return (
    <section className="space-y-6" aria-busy="true" aria-live="polite">
      <SkeletonTopBar />
      <SkeletonHero />
      <SkeletonStatTrio />
      <SkeletonCard height="h-28" />
    </section>
  );
}
