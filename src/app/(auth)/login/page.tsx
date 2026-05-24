'use client';

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <p className="caption text-fg3">Controle Financeiro</p>
        <h1>Entrar</h1>
        <p className="text-fg2">
          Receba um link mágico no seu email para entrar.
        </p>
      </header>

      <form
        className="space-y-4"
        onSubmit={(event) => event.preventDefault()}
        noValidate
      >
        <label className="block space-y-2">
          <span className="caption text-fg3">Email</span>
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-base text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          />
        </label>
        <button
          type="submit"
          disabled
          aria-disabled="true"
          className="block w-full min-h-11 rounded-md bg-teal px-3 py-3 font-semibold text-on-primary transition-colors hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Enviar link mágico
        </button>
        <p className="text-center text-sm text-fg3">
          Em breve. O envio do link ainda não está ativo.
        </p>
      </form>
    </div>
  );
}
