'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyInput } from '@/components/finance/money-input';
import { Num, type Currency } from '@/components/finance/num';
import {
  deleteSnapshotAction,
  listSnapshotsAction,
  setSnapshotAction,
} from '@/server/actions/snapshots/actions';
import { cn } from '@/lib/utils';
import { toLocalIsoDate } from '@/lib/dates';

type Snapshot = {
  id: string;
  snapshot_date: string;
  balance_cents: number;
  source: string;
};

type Props = {
  accountId: string;
  accountName: string;
  currency: Currency;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

function todayIso(): string {
  return toLocalIsoDate(new Date());
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function BalanceHistoryDialog({
  accountId,
  accountName,
  currency,
  open,
  onOpenChange,
}: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; date: string; cents: number } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const rows = await listSnapshotsAction({ accountId, limit: 24 });
      if (!cancelled) {
        setSnapshots(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accountId]);

  async function reload() {
    const rows = await listSnapshotsAction({ accountId, limit: 24 });
    setSnapshots(rows);
  }

  function startAdd() {
    setEditing({ id: null, date: todayIso(), cents: 0 });
  }

  function startEdit(snap: Snapshot) {
    setEditing({ id: snap.id, date: snap.snapshot_date, cents: snap.balance_cents });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function commit() {
    if (!editing || pending) return;
    setPending(true);
    const result = await setSnapshotAction({
      accountId,
      snapshotDate: editing.date,
      balanceCents: editing.cents,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editing.id ? 'Snapshot atualizado.' : 'Snapshot adicionado.');
    setEditing(null);
    await reload();
  }

  async function handleDelete(snap: Snapshot) {
    if (pending) return;
    setPending(true);
    const result = await deleteSnapshotAction({ snapshotId: snap.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Snapshot removido.');
    await reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Histórico de saldo · {accountName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-4">
          <p className="text-[12px] text-fg3">
            Cron captura todo domingo. Você pode ajustar ou inserir manualmente — ajustes manuais
            nunca são sobrescritos.
          </p>

          {!editing && (
            <button
              type="button"
              onClick={startAdd}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-soft bg-transparent px-3 text-sm font-medium text-fg3 transition-colors hover:border-border-strong hover:text-fg1"
            >
              <Plus className="size-4" strokeWidth={1.6} aria-hidden />
              Adicionar snapshot
            </button>
          )}

          {editing && (
            <div className="space-y-3 rounded-md border border-border bg-bg-inset p-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Data</span>
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-fg3" strokeWidth={1.6} aria-hidden />
                  <input
                    type="date"
                    required
                    autoFocus
                    value={editing.date}
                    disabled={editing.id !== null}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    className="block min-h-9 flex-1 rounded-sm border border-border bg-bg-surface px-2 py-1 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  />
                </div>
                {editing.id !== null && (
                  <span className="text-[10px] text-fg4">Data fixa em edits. Remova e crie novo pra mudar.</span>
                )}
              </label>
              <MoneyInput
                label="Saldo"
                valueCents={editing.cents}
                onChange={(cents) => setEditing({ ...editing, cents })}
                allowSign
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={pending}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-border-soft text-sm font-medium text-fg2 hover:text-fg1 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={commit}
                  disabled={pending}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-brand text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {pending ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-sm text-fg4">Carregando…</p>
          ) : snapshots.length === 0 ? (
            <p className="text-center text-sm text-fg4">
              Sem snapshots ainda. O cron começa a capturar no próximo domingo, ou adiciona um
              manualmente.
            </p>
          ) : (
            <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-fg2">{formatDateBR(s.snapshot_date)}</span>
                    <span
                      className={cn(
                        'mono text-[10px] uppercase tracking-wider',
                        s.source === 'manual' ? 'text-brand' : 'text-fg4',
                      )}
                    >
                      {s.source}
                    </span>
                  </div>
                  <Num
                    cents={s.balance_cents}
                    currency={currency}
                    className="shrink-0 font-semibold text-fg1"
                  />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      disabled={pending}
                      aria-label="Editar"
                      className="inline-flex size-7 items-center justify-center rounded-sm text-fg3 hover:bg-bg-raised hover:text-fg1 disabled:opacity-60"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.6} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      disabled={pending}
                      aria-label="Excluir"
                      className="inline-flex size-7 items-center justify-center rounded-sm text-fg3 hover:bg-bg-raised hover:text-money-negative disabled:opacity-60"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
