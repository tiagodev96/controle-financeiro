# Provisionamento manual de usuários

Auth é **email + senha + allowlist** (decisão registrada em [`docs/prds/password-auth.md`](../prds/password-auth.md)). Não há signup self-service nem reset de senha por UI. Adicionar um usuário é tarefa operacional do Tiago no dashboard do Supabase + atualização de env var no Vercel.

---

## Quando usar

- **Primeiro deploy em produção** — criar `tiago@<domínio>` e `laine@<domínio>`.
- **Esqueci a senha** — resetar manualmente.
- **Adicionar 3ª pessoa eventualmente** — criar usuário + entrar na allowlist.

---

## Passo a passo: criar usuário novo em produção

### 1. Definir senha forte

Use um password manager (1Password, Apple Keychain). Senha aleatória de 20+ caracteres. **Não mande por SMS/email puro** — só por canal seguro (Signal, Apple Messages com fim-a-fim, ou em pessoa).

### 2. Criar no Supabase dashboard

1. `dashboard.supabase.com` → projeto de produção.
2. **Authentication → Users → Add user → Create new user**.
3. Preencher:
   - **Email** — o email real da pessoa (ex: `laine@example.com`)
   - **Password** — a senha forte gerada no passo 1
   - **Auto Confirm User** — `true` (não usamos email confirmation)
4. Confirmar.

### 3. Criar o profile + household no SQL Editor

O trigger automatico de criação de profile **não existe** — o schema atual exige profile manual:

```sql
-- Substituir os valores entre { } pelos reais
insert into households (id, name, base_currency)
values ('{novo-uuid}', 'Household Tiago + Laine', 'EUR')
on conflict (id) do nothing;

insert into profiles (id, household_id, display_name)
values (
  '{auth-user-id-do-passo-2}',
  '{novo-uuid}',
  'Laine'
)
on conflict (id) do nothing;
```

> Se a pessoa entra num household existente (ex: Laine entrando no household do Tiago): pular o `insert into households` e usar o `household_id` existente.

### 4. Atualizar `AUTH_ALLOWED_EMAILS` no Vercel

1. Vercel dashboard → projeto → **Settings → Environment Variables**.
2. Editar `AUTH_ALLOWED_EMAILS`.
3. Adicionar o novo email separado por vírgula:
   ```
   tiago@example.com,laine@example.com
   ```
4. Salvar. **Redeploy obrigatório** — env vars novas só pegam em build novo.

### 5. Smoke test

1. Pingar o usuário com o link de produção + a senha (canal seguro).
2. Verificar que ela consegue logar e ver o dashboard com household correto.
3. Se algo der errado: ver logs do Supabase Auth + ajustar.

---

## Reset de senha esquecida

1. Supabase dashboard → **Authentication → Users**.
2. Achar o usuário, clicar nos `⋯` → **Send password recovery** **NÃO** (não temos handler).
3. Em vez disso: **Edit user → Reset password** → gerar nova senha.
4. Compartilhar a nova senha via canal seguro com o usuário.
5. Pedir pra trocar quando logar (essa feature ainda não existe na UI — vai virar PRD própria de página de conta).

---

## Habilitar `AUTH_ENABLED` em produção (rollout)

A flag `AUTH_ENABLED` no env controla se `/login` aceita submit:
- `false` → UI mostra "Em breve. O login ainda não está ativo." (stub)
- `true` → form funcional

Procedimento de primeira ativação:

1. Confirmar que `AUTH_ALLOWED_EMAILS` está populado em prod.
2. Confirmar que os 2 usuários estão criados no Supabase + profiles existem.
3. Set `AUTH_ENABLED=true` no Vercel → trigger redeploy.
4. Smoke test pessoal do Tiago primeiro. Se OK, avisar Laine.

> Não deixe `AUTH_ENABLED=false` em prod por acidente após a ativação — Laine vai ver "Em breve" achando que o app está quebrado.

---

## Allowlist em dev

`.env.local` precisa incluir os **fixture users do seed** pra desenvolvimento manual funcionar:

```
AUTH_ENABLED=true
AUTH_ALLOWED_EMAILS=tiago@example.com,empty@example.com,...
```

`tiago@example.com` é o fixture principal do seed (senha `password-local`). `empty@example.com` é fixture pra E3 (household sem categorias). E2E + integração usam o helper `signInAsFixtureUser` em `tests/helpers/auth.ts` — não passam pela allowlist (signInWithPassword é direto contra o GoTrue local).

---

## Quem mexer

Só o Tiago. Não delegar — não há automação que mascare erros (sem signup, sem flow auto-confirm). Se Laine precisar adicionar alguém: ping Tiago.
