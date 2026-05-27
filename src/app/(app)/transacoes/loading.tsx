import {
  SkeletonTopBar,
  SkeletonCard,
  SkeletonTxnGroup,
} from '@/components/finance/skeletons';

export default function TransacoesLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <SkeletonTopBar />

      <SkeletonCard height="h-20" />

      <SkeletonTxnGroup rows={4} />
      <SkeletonTxnGroup rows={3} />
    </section>
  );
}
