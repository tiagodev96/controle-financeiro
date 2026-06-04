import { EuroHistoryChart } from '@/components/finance/euro-history-chart';
import { ConversionSignalCard } from '@/components/finance/conversion-signal-card';
import { ConversionsManager } from '@/components/finance/record-conversion-form';
import { getFxBlockData } from '@/lib/finance/fx-block-data';

export async function FxBlock({ nowIso }: { nowIso: string }) {
  const data = await getFxBlockData(nowIso);
  if (!data) return null;

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-fg3">Câmbio</h2>
        <span className="mono text-[10px] text-fg4">euro / real</span>
      </header>
      <EuroHistoryChart series={data.series} />
      <ConversionSignalCard
        advice={data.advice}
        rateDate={data.rateDate}
        isStale={data.isStale}
      />
      <ConversionsManager conversions={data.conversions} />
    </section>
  );
}
