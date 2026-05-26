'use client';

import { useState } from 'react';
import { Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

type Props = { text: string };

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareCopyActions({ text }: Props) {
  const [pending, setPending] = useState(false);

  async function handleShare() {
    if (pending) return;
    setPending(true);
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({ title: 'Resumo do mês', text });
          return;
        } catch (err) {
          if (isAbortError(err)) return;
          // Cai pro fallback de clipboard se share falhou por outro motivo.
        }
      }
      const ok = await copyToClipboard(text);
      toast[ok ? 'success' : 'error'](ok ? 'Resumo copiado.' : 'Não foi possível copiar.');
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (pending) return;
    setPending(true);
    const ok = await copyToClipboard(text);
    toast[ok ? 'success' : 'error'](ok ? 'Resumo copiado.' : 'Não foi possível copiar.');
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={handleShare}
        disabled={pending}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Share2 className="size-4" strokeWidth={1.6} aria-hidden />
        Compartilhar resumo
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={pending}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-bg-inset text-sm font-medium text-fg1 transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Copy className="size-4" strokeWidth={1.6} aria-hidden />
        Copiar texto
      </button>
    </div>
  );
}
