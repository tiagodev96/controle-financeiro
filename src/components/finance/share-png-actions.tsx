'use client';

import { useState } from 'react';
import { ImageDown, Copy } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  /** Texto fallback (usado pelo botão secundário "Copiar texto"). */
  text: string;
  /** YYYY-MM do mês exibido — vai na URL da imagem + filename. */
  monthIso: string;
  /** 'EUR' | 'BRL' — vai na URL da imagem. */
  moeda: 'EUR' | 'BRL';
};

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

function canShareFiles(files: File[]): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberar depois de um tick — alguns browsers ainda estão lendo o blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SharePngActions({ text, monthIso, moeda }: Props) {
  const [pending, setPending] = useState(false);

  async function handleShareImage() {
    if (pending) return;
    setPending(true);
    try {
      const ogUrl = `/api/resumo/og?mes=${monthIso}${moeda !== 'EUR' ? `&moeda=${moeda.toLowerCase()}` : ''}`;
      const res = await fetch(ogUrl);

      if (res.status === 204) {
        toast.error('Sem dados pra compartilhar.');
        return;
      }
      if (!res.ok) {
        toast.error('Imagem indisponível. Copie o texto pelo botão ao lado.');
        return;
      }

      const blob = await res.blob();
      const filename = `resumo-${monthIso}-${moeda.toLowerCase()}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (canShareFiles([file])) {
        try {
          await navigator.share({
            files: [file],
            title: 'Resumo do mês',
            text: `Resumo de ${monthIso}`,
          });
          return;
        } catch (err) {
          if (isAbortError(err)) return;
          // Cai pro download se share falhou por outro motivo.
        }
      }

      triggerDownload(blob, filename);
      toast.success('Imagem baixada.');
    } catch (err) {
      console.error('share png failed', err);
      toast.error('Imagem indisponível. Copie o texto pelo botão ao lado.');
    } finally {
      setPending(false);
    }
  }

  async function handleCopyText() {
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
        onClick={handleShareImage}
        disabled={pending}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <ImageDown className="size-4" strokeWidth={1.6} aria-hidden />
        {pending ? 'Gerando…' : 'Compartilhar imagem'}
      </button>
      <button
        type="button"
        onClick={handleCopyText}
        disabled={pending}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-bg-inset text-sm font-medium text-fg1 transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Copy className="size-4" strokeWidth={1.6} aria-hidden />
        Copiar texto
      </button>
    </div>
  );
}
