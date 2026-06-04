import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordConversionForm } from './record-conversion-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const recordConversionAction = vi.fn();
vi.mock('@/server/actions/conversions/actions', () => ({
  recordConversionAction: (input: unknown) => recordConversionAction(input),
  deleteConversionAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  recordConversionAction.mockReset();
});

describe('<RecordConversionForm>', () => {
  it('C1 — submeter sem valores mostra erro e não chama a action', async () => {
    const user = userEvent.setup();
    render(<RecordConversionForm />);

    await user.click(screen.getByRole('button', { name: 'Registrar conversão' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe os dois valores.');
    expect(recordConversionAction).not.toHaveBeenCalled();
  });

  it('C2 — preenche e submete: chama action com centavos e direção EUR→BRL', async () => {
    recordConversionAction.mockResolvedValue({ ok: true, conversion: { id: 'x' } });
    const user = userEvent.setup();
    render(<RecordConversionForm />);

    await user.type(screen.getByLabelText('Enviado (€)'), '100000');
    await user.type(screen.getByLabelText('Recebido (R$)'), '595000');
    await user.click(screen.getByRole('button', { name: 'Registrar conversão' }));

    await waitFor(() => expect(recordConversionAction).toHaveBeenCalledTimes(1));
    expect(recordConversionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        fromCurrency: 'EUR',
        toCurrency: 'BRL',
        fromAmountCents: 100_000,
        toAmountCents: 595_000,
      }),
    );
  });

  it('C3 — toggle inverte a direção pra Real → Euro', async () => {
    recordConversionAction.mockResolvedValue({ ok: true, conversion: { id: 'x' } });
    const user = userEvent.setup();
    render(<RecordConversionForm />);

    await user.click(screen.getByRole('button', { name: 'Real → Euro' }));
    await user.type(screen.getByLabelText('Enviado (R$)'), '600000');
    await user.type(screen.getByLabelText('Recebido (€)'), '98000');
    await user.click(screen.getByRole('button', { name: 'Registrar conversão' }));

    await waitFor(() => expect(recordConversionAction).toHaveBeenCalledTimes(1));
    expect(recordConversionAction).toHaveBeenCalledWith(
      expect.objectContaining({ fromCurrency: 'BRL', toCurrency: 'EUR' }),
    );
  });
});
