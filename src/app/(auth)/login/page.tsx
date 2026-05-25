import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="caption">Controle Financeiro</p>
        <h1>Entrar</h1>
      </header>
      <LoginForm authEnabled={authEnabled} />
    </div>
  );
}
