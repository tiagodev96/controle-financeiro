'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  recordConversionAction,
  deleteConversionAction,
} from '@/server/actions/conversions/actions';
import type { ConversionListItem } from '@/lib/finance/fx-block-data';
import { MoneyInput } from './money-input';
import { Field } from './field';
import { formatCentsToBRL, formatRate } from '@/lib/money/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toLocalIsoDate } from '@/lib/dates';

type Direction = 'EUR_BRL' | 'BRL_EUR';

const SYMBOL = { EUR: '€', BRL: 'R$' } as const;

function todayIsoDate(): string {
  return toLocalIsoDate(new Date());
}

export function RecordConversionForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [direction, setDirection] = useState<Direction>('EUR_BRL');
  const [fromCents, setFromCents] = useState(0);
  const [toCents, setToCents] = useState(0);
  const [date, setDate] = useState(todayIsoDate);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const fromCurrency = direction === 'EUR_BRL' ? 'EUR' : 'BRL';
  const toCurrency = direction === 'EUR_BRL' ? 'BRL' : 'EUR';

  function openDatePicker() {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    if (fromCents <= 0 || toCents <= 0) {
      setError('Informe os dois valores.');
      return;
    }

    setPending(true);
    const result = await recordConversionAction({
      fromCurrency,
      toCurrency,
      fromAmountCents: fromCents,
      toAmountCents: toCents,
      convertedOn: date,
      note: note.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    toast.success('Conversão registrada.');
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-1.5">
        {(['EUR_BRL', 'BRL_EUR'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            aria-pressed={direction === d}
            className={cn(
              'min-h-10 rounded-md border px-3 text-sm font-medium transition-colors',
              direction === d
                ? 'border-brand/40 bg-brand-quiet-bg font-semibold text-brand-quiet-fg'
                : 'border-border-soft bg-bg-inset text-fg2 hover:border-border-strong hover:text-fg1',
            )}
          >
            {d === 'EUR_BRL' ? 'Euro → Real' : 'Real → Euro'}
          </button>
        ))}
      </div>

      <MoneyInput
        label={`Enviado (${SYMBOL[fromCurrency]})`}
        valueCents={fromCents}
        onChange={setFromCents}
        autoFocus
      />
      <MoneyInput
        label={`Recebido (${SYMBOL[toCurrency]})`}
        valueCents={toCents}
        onChange={setToCents}
      />

      {fromCents > 0 && toCents > 0 && (
        <p className="text-[12px] text-fg4">
          Taxa efetiva:{' '}
          <span className="num text-fg2">{formatRate(toCents / fromCents)}</span>{' '}
          {SYMBOL[toCurrency]}/{SYMBOL[fromCurrency]}
        </p>
      )}

      <Field label="Data">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openDatePicker}
            aria-label="Abrir calendário"
            className="shrink-0 rounded-xs text-fg3 transition-colors hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Calendar className="size-3.5" strokeWidth={1.6} aria-hidden />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            name="data"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg1 focus-visible:outline-none"
          />
        </div>
      </Field>

      <label className="block space-y-2">
        <span className="eyebrow">Nota (opcional)</span>
        <input
          type="text"
          value={note}
          maxLength={120}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex: Wise"
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-money-negative">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-[15px] font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Registrar conversão'}
      </button>
    </form>
  );
}

function ConversionRow({ item }: { item: ConversionListItem }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    const result = await deleteConversionAction({ conversionId: item.id });
    if (!result.ok) {
      toast.error(result.error);
      setDeleting(false);
      return;
    }
    toast.success('Conversão removida.');
    router.refresh();
  }

  const arrow = item.fromCurrency === 'EUR' ? 'Euro → Real' : 'Real → Euro';

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] text-fg1">
          {arrow}{' '}
          <span className="mono text-[10px] text-fg4">
            {item.convertedOn.slice(8, 10)}/{item.convertedOn.slice(5, 7)}
          </span>
        </p>
        <p className="text-[11px] text-fg4">
          <span className="num">
            {SYMBOL[item.fromCurrency]} {formatCentsToBRL(item.fromAmountCents)}
          </span>{' '}
          →{' '}
          <span className="num">
            {SYMBOL[item.toCurrency]} {formatCentsToBRL(item.toAmountCents)}
          </span>
          {item.note ? ` · ${item.note}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Remover conversão"
        className="shrink-0 rounded-md p-1.5 text-fg4 transition-colors hover:text-money-negative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Trash2 className="size-4" strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  );
}

const PAGE_SIZE = 10;

export function ConversionsManager({
  conversions,
}: {
  conversions: ConversionListItem[];
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(conversions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = conversions.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
      <header className="flex items-center justify-between">
        <p className="eyebrow">Conversões</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-bg-inset px-2 text-[11px] font-semibold text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus className="size-3.5" strokeWidth={1.8} aria-hidden />
            Registrar
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar conversão</DialogTitle>
            </DialogHeader>
            <RecordConversionForm onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </header>

      {conversions.length === 0 ? (
        <p className="text-[12px] text-fg4">
          Nenhuma conversão registrada. Registre a última pra acompanhar o spread da Wise.
        </p>
      ) : (
        <>
          <div className="divide-y divide-border-soft">
            {pageItems.map((item) => (
              <ConversionRow key={item.id} item={item} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-fg3 transition-colors hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:text-fg3"
              >
                Anterior
              </button>
              <span className="mono text-[10px] text-fg4">
                {currentPage + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-fg3 transition-colors hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:text-fg3"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
