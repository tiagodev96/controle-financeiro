import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { signInCore } from '@/server/actions/auth/sign-in-core';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function freshAnonClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe('signInCore (integração)', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv(
      'AUTH_ALLOWED_EMAILS',
      'owner@example.com,empty@example.com',
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('I-A1 — credenciais válidas + allowlist → ok:true e sessão emitida pelo Supabase', async () => {
    const supabase = freshAnonClient();
    const result = await signInCore(
      { supabase },
      { email: 'owner@example.com', password: 'password-local' },
    );

    expect(result.ok).toBe(true);
    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.email).toBe('owner@example.com');
  });

  it('I-A2 — senha errada → ok:false com mensagem genérica, sem distinção', async () => {
    const supabase = freshAnonClient();
    const result = await signInCore(
      { supabase },
      { email: 'owner@example.com', password: 'senha-errada' },
    );

    expect(result).toEqual({ ok: false, error: 'Email ou senha inválidos.' });
  });

  it('I-A3 — email fora da allowlist → ok:false e signInWithPassword NÃO é chamado', async () => {
    const supabase = freshAnonClient();
    const spy = vi.spyOn(supabase.auth, 'signInWithPassword');

    const result = await signInCore(
      { supabase },
      { email: 'outsider@example.com', password: 'qualquer' },
    );

    expect(result).toEqual({ ok: false, error: 'Email ou senha inválidos.' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('I-A4 — AUTH_ENABLED=false → curto-circuita antes do Supabase', async () => {
    vi.stubEnv('AUTH_ENABLED', 'false');
    const supabase = freshAnonClient();
    const spy = vi.spyOn(supabase.auth, 'signInWithPassword');

    const result = await signInCore(
      { supabase },
      { email: 'owner@example.com', password: 'password-local' },
    );

    expect(result).toEqual({ ok: false, error: 'Email ou senha inválidos.' });
    expect(spy).not.toHaveBeenCalled();
  });
});
