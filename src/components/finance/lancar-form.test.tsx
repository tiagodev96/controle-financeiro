import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LancarForm } from './lancar-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const createTransaction = vi.fn();
vi.mock('@/server/actions/transactions/create', () => ({
  createTransaction: (input: unknown) => createTransaction(input),
}));

type Category = { id: string; name: string };
type Account = { id: string; name: string; currency: 'BRL' | 'EUR' };

const categories: Category[] = [
  { id: 'cat-mercado', name: 'Mercado' },
  { id: 'cat-restaurante', name: 'Restaurante' },
  { id: 'cat-transporte', name: 'Transporte' },
];

const accounts: Account[] = [
  { id: 'acc-itau', name: 'Itaú', currency: 'BRL' },
  { id: 'acc-revolut', name: 'Revolut', currency: 'EUR' },
];

beforeEach(() => {
  push.mockReset();
  createTransaction.mockReset();
});

describe('<LancarForm>', () => {
  it('C1 — renderiza um chip por categoria recebida e troca o ativo no clique', async () => {
    const user = userEvent.setup();
    render(
      <LancarForm categories={categories} accounts={accounts} lastAccountId={null} />,
    );

    expect(screen.getByRole('button', { name: 'Mercado' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Restaurante' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Transporte' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Restaurante' }));

    expect(screen.getByRole('button', { name: 'Restaurante' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Mercado' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('C3 — durante pending, botão fica disabled, label vira "Lançando..." e clique duplo não dispara a action de novo', async () => {
    let resolveAction!: (value: { ok: true; transaction: { id: string } }) => void;
    createTransaction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(
      <LancarForm categories={categories} accounts={accounts} lastAccountId={null} />,
    );

    await user.type(screen.getByLabelText('Valor'), '12,50');
    await user.type(screen.getByLabelText('Descrição'), 'Café');
    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    const pendingButton = await screen.findByRole('button', { name: 'Lançando...' });
    expect(pendingButton).toBeDisabled();
    expect(createTransaction).toHaveBeenCalledTimes(1);

    await user.click(pendingButton);
    expect(createTransaction).toHaveBeenCalledTimes(1);

    // Resolve pra evitar warnings de unmount com promise pendente.
    resolveAction({ ok: true, transaction: { id: 'txn-1' } });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lançando...' })).not.toBeInTheDocument();
    });
  });

  it('C4 — erro do servidor aparece inline em role=alert e botão volta a habilitar', async () => {
    createTransaction.mockResolvedValue({ ok: false, error: 'Conta arquivada' });

    const user = userEvent.setup();
    render(
      <LancarForm categories={categories} accounts={accounts} lastAccountId={null} />,
    );

    await user.type(screen.getByLabelText('Valor'), '12,50');
    await user.type(screen.getByLabelText('Descrição'), 'x');
    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conta arquivada');
    expect(screen.getByRole('button', { name: 'Lançar' })).not.toBeDisabled();
  });

  it('C5 — após erro, mantém valores digitados e categoria selecionada', async () => {
    createTransaction.mockResolvedValue({ ok: false, error: 'erro qualquer' });

    const user = userEvent.setup();
    render(
      <LancarForm categories={categories} accounts={accounts} lastAccountId={null} />,
    );

    await user.type(screen.getByLabelText('Valor'), '12,50');
    await user.type(screen.getByLabelText('Descrição'), 'Café no Starbucks');
    await user.click(screen.getByRole('button', { name: 'Restaurante' }));
    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    await screen.findByRole('alert');

    expect(screen.getByLabelText('Valor')).toHaveValue('12,50');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Café no Starbucks');
    expect(screen.getByRole('button', { name: 'Restaurante' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it.each([
    ['válido na lista', 'acc-revolut', 'acc-revolut'],
    ['null', null, 'acc-itau'],
    ['inexistente na lista', 'acc-inexistente', 'acc-itau'],
  ] as const)(
    'C6 — lastAccountId %s → select inicial = %s',
    (_label, lastAccountId, expected) => {
      render(
        <LancarForm
          categories={categories}
          accounts={accounts}
          lastAccountId={lastAccountId}
        />,
      );
      expect(screen.getByLabelText('Conta')).toHaveValue(expected);
    },
  );

  it('C7 — submit sem digitar valor envia 0 e mostra erro do servidor inline', async () => {
    createTransaction.mockResolvedValue({ ok: false, error: 'Valor inválido.' });

    const user = userEvent.setup();
    render(
      <LancarForm categories={categories} accounts={accounts} lastAccountId={null} />,
    );

    await user.type(screen.getByLabelText('Descrição'), 'x');
    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 0 }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/v[áa]lido/i);
  });

  it('C8 — sucesso renderiza confirmação e dispara router.push("/") após o delay', async () => {
    createTransaction.mockResolvedValue({ ok: true, transaction: { id: 'txn-1' } });

    const user = userEvent.setup();
    render(
      <LancarForm categories={categories} accounts={accounts} lastAccountId={null} />,
    );

    await user.type(screen.getByLabelText('Valor'), '12,50');
    await user.type(screen.getByLabelText('Descrição'), 'Café');
    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Despesa lançada.');
    expect(push).not.toHaveBeenCalled();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'), { timeout: 1500 });
  });
});
