'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail } from '@/server/actions/auth/sign-in';

type Props = {
  authEnabled: boolean;
};

export function LoginForm({ authEnabled }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);

    const result = await signInWithEmail({ email, password });

    if (!result.ok) {
      setError(result.error);
      setPassword('');
      setPending(false);
      return;
    }

    router.push('/');
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <label className="block space-y-2">
        <span className="eyebrow">Email</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!authEnabled}
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      <label className="block space-y-2">
        <span className="eyebrow">Senha</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!authEnabled}
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-money-negative">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!authEnabled || pending}
        aria-disabled={!authEnabled || pending}
        className="block w-full min-h-11 rounded-md bg-brand px-3 py-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>

      {!authEnabled && (
        <p className="text-center text-sm text-fg3">
          Em breve. O login ainda não está ativo.
        </p>
      )}
    </form>
  );
}
