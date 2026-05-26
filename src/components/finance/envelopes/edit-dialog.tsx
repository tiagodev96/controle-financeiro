'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyInput } from '@/components/finance/money-input';
import { updateEnvelopeAction } from '@/server/actions/envelopes/actions';

type Props = {
  envelopeId: string;
  currentName: string;
  currentTargetCents: number | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function EditEnvelopeDialog({
  envelopeId,
  currentName,
  currentTargetCents,
  open,
  onOpenChange,
}: Props) {
  const [name, setName] = useState(currentName);
  const [targetCents, setTargetCents] = useState(currentTargetCents ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await updateEnvelopeAction({
      envelopeId,
      patch: {
        name,
        targetCents: targetCents > 0 ? targetCents : null,
      },
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Caixinha atualizada.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar caixinha</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <label className="block space-y-2">
            <span className="eyebrow">Nome</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <MoneyInput
            label="Meta (opcional)"
            valueCents={targetCents}
            onChange={setTargetCents}
          />

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
