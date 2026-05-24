import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <p className="caption text-fg3">Controle Financeiro</p>
        <h1>Entrar</h1>
        <p className="text-fg2">Use seu email e senha.</p>
      </header>

      <LoginForm authEnabled={authEnabled} />
    </div>
  );
}
