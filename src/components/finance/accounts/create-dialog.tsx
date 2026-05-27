'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createAccountAction } from '@/server/actions/accounts/actions';
import { MoneyInput } from '@/components/finance/money-input';
import { cn } from '@/lib/utils';

type Currency = 'EUR' | 'BRL';

export function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [balance, setBalance] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await createAccountAction({
      name,
      currency,
      initialBalanceCents: balance,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Conta criada.');
    setName('');
    setCurrency('EUR');
    setBalance(0);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden />
            Nova conta
          </button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <label className="block space-y-2">
            <span className="eyebrow">Moeda</span>
            <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
              {(['EUR', 'BRL'] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                  className={cn(
                    'h-9 rounded-sm text-sm font-medium transition-colors',
                    currency === c ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </label>

          <label className="block space-y-2">
            <span className="eyebrow">Nome</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Itaú corrente"
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <MoneyInput
            label="Saldo inicial"
            name="saldo"
            valueCents={balance}
            onChange={setBalance}
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
            {pending ? 'Salvando…' : 'Criar conta'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
