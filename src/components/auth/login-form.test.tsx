import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const signInWithEmail = vi.fn();
vi.mock('@/server/actions/auth/sign-in', () => ({
  signInWithEmail: (input: unknown) => signInWithEmail(input),
}));

beforeEach(() => {
  push.mockReset();
  signInWithEmail.mockReset();
});

describe('<LoginForm>', () => {
  it('C-A1 — authEnabled=false → inputs e botão disabled, mostra "Em breve"', () => {
    render(<LoginForm authEnabled={false} />);

    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/senha/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled();
    expect(screen.getByText(/em breve/i)).toBeInTheDocument();
  });

  it('C-A2 — durante pending, botão fica disabled e label vira "Entrando…"', async () => {
    let resolveAction!: (value: { ok: true }) => void;
    signInWithEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<LoginForm authEnabled={true} />);

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    const pendingButton = await screen.findByRole('button', { name: /entrando/i });
    expect(pendingButton).toBeDisabled();
    expect(signInWithEmail).toHaveBeenCalledTimes(1);

    // Clique duplo durante pending não dispara segunda chamada.
    await user.click(pendingButton);
    expect(signInWithEmail).toHaveBeenCalledTimes(1);

    resolveAction({ ok: true });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('C-A3 — erro do servidor aparece inline em role=alert e botão reabilita', async () => {
    signInWithEmail.mockResolvedValue({ ok: false, error: 'Email ou senha inválidos.' });

    const user = userEvent.setup();
    render(<LoginForm authEnabled={true} />);

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/inv[áa]lidos/i);
    expect(screen.getByRole('button', { name: /entrar/i })).not.toBeDisabled();
  });

  it('C-A4 — sucesso → router.push("/") é chamado', async () => {
    signInWithEmail.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    render(<LoginForm authEnabled={true} />);

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('C-A5 — após erro, mantém email mas reseta senha (postura defensiva)', async () => {
    signInWithEmail.mockResolvedValue({ ok: false, error: 'Email ou senha inválidos.' });

    const user = userEvent.setup();
    render(<LoginForm authEnabled={true} />);

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await screen.findByRole('alert');

    expect(screen.getByLabelText(/email/i)).toHaveValue('owner@example.com');
    expect(screen.getByLabelText(/senha/i)).toHaveValue('');
  });
});
