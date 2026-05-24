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

      <form className="space-y-4" action="#" method="post">
        <label className="block space-y-2">
          <span className="caption text-fg3">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="block w-full rounded-md border border-border bg-bg-inset px-3 py-2 text-fg1 placeholder:text-fg4 focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </label>
        <button
          type="submit"
          className="block w-full rounded-md bg-teal px-3 py-2 font-semibold text-on-primary transition-colors hover:bg-teal/90"
        >
          Enviar link mágico
        </button>
      </form>
    </div>
  );
}
