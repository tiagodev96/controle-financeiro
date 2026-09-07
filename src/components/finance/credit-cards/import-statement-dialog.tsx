'use client';

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormSelect } from '@/components/finance/form-select';
import { importCardStatementAction } from '@/server/actions/credit-cards/actions';
import { formatCents } from '@/lib/money/format';

type Category = { id: string; name: string };

type Props = {
  cardId: string;
  cardName: string;
  hasSavedPassword: boolean;
  categories: Category[];
};

type Preview = {
  imported: number;
  skippedExisting: number;
  ignoredCount: number;
  importedCents: number;
  statementTotalCents: number | null;
  dueOn: string;
  monthLabel: string;
};

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function ImportStatementDialog({ cardId, cardName, hasSavedPassword, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildFormData(mode: 'preview' | 'import'): FormData | null {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return null;
    const formData = new FormData();
    formData.set('cardId', cardId);
    formData.set('mode', mode);
    formData.set('file', file);
    formData.set('password', password);
    formData.set('categoryId', categoryId);
    return formData;
  }

  async function handlePreview() {
    if (pending) return;
    const formData = buildFormData('preview');
    if (!formData) {
      setError('Escolha o arquivo da fatura.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await importCardStatementAction(formData);
    setPending(false);
    if (!result.ok) {
      setPreview(null);
      setError(result.error);
      return;
    }
    setPreview(result);
  }

  async function handleImport() {
    if (pending || !preview) return;
    const formData = buildFormData('import');
    if (!formData) {
      setError('Escolha o arquivo da fatura.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await importCardStatementAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(
      result.imported > 0
        ? `Fatura importada: ${result.imported} ${result.imported === 1 ? 'compra' : 'compras'}.`
        : 'Nada novo pra importar — fatura já estava no app.',
    );
    setOpen(false);
    setPreview(null);
    setPassword('');
  }

  const mismatch =
    preview !== null &&
    preview.statementTotalCents !== null &&
    preview.importedCents !== preview.statementTotalCents &&
    preview.skippedExisting === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPreview(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Importar fatura do ${cardName}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-soft bg-bg-inset px-2.5 text-[13px] font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileUp className="size-3.5" strokeWidth={1.6} aria-hidden />
            Importar fatura
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar fatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-4">
          <label className="block space-y-2">
            <span className="eyebrow">Arquivo (.xlsx do banco)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={() => {
                setPreview(null);
                setError(null);
              }}
              className="block w-full rounded-md border border-border bg-bg-inset px-3 py-2.5 text-sm text-fg1 file:mr-3 file:rounded-sm file:border-0 file:bg-bg-raised file:px-2 file:py-1 file:text-[12px] file:font-medium file:text-fg2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="block space-y-2">
            <span className="eyebrow">Senha da fatura</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPreview(null);
              }}
              placeholder={hasSavedPassword ? 'Salva — deixe em branco pra usar' : 'Senha do arquivo'}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <FormSelect
            label="Categoria padrão das compras"
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setPreview(null);
            }}
            options={[
              { value: '', label: 'Sem categoria (definir depois)' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {preview && (
            <div
              data-testid="import-preview"
              className="space-y-1.5 rounded-md border border-border-soft bg-bg-inset px-3 py-2.5 text-[13px] text-fg2"
            >
              <p className="font-medium text-fg1">
                {preview.monthLabel} · vence {shortDate(preview.dueOn)}
              </p>
              <p>
                {preview.imported} {preview.imported === 1 ? 'compra nova' : 'compras novas'} ·{' '}
                {formatCents(preview.importedCents, 'BRL')}
              </p>
              {preview.skippedExisting > 0 && (
                <p className="text-fg3">{preview.skippedExisting} já no app (serão puladas)</p>
              )}
              {preview.ignoredCount > 0 && (
                <p className="text-fg3">{preview.ignoredCount} linhas ignoradas (créditos/saques)</p>
              )}
              {preview.statementTotalCents !== null && (
                <p className="mono text-[10px] text-fg4">
                  total do arquivo: {formatCents(preview.statementTotalCents, 'BRL')}
                  {mismatch && ' · difere do importável — confira depois'}
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          {preview === null ? (
            <button
              type="button"
              onClick={handlePreview}
              disabled={pending}
              className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Lendo…' : 'Pré-visualizar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImport}
              disabled={pending || preview.imported === 0}
              className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? 'Importando…'
                : preview.imported === 0
                  ? 'Nada novo pra importar'
                  : `Importar ${preview.imported} ${preview.imported === 1 ? 'compra' : 'compras'}`}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
