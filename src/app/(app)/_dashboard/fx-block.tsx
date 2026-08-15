import { EuroHistoryChart } from '@/components/finance/euro-history-chart';
import { getFxBlockData } from '@/lib/finance/fx-block-data';

export async function FxBlock({ nowIso }: { nowIso: string }) {
  const series = await getFxBlockData(nowIso);
  if (series.length === 0) return null;

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-fg3">Câmbio</h2>
        <span className="mono text-[10px] text-fg4">euro / real</span>
      </header>
      <EuroHistoryChart series={series} />
    </section>
  );
}
