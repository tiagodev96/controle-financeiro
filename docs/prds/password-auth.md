# Login com email + senha + allowlist

> Esta PRD substitui a proposta original de magic link (arquivo anterior `magic-link-auth.md`, renomeado). Magic link foi descartado: depende de SMTP, tem risco cross-device, e a complexidade não se justifica pra 2 usuários onde o Tiago provisiona contas manualmente.

## Problema

Hoje o app não tem como autenticar ninguém em produção. `/login` mostra um campo de email e um botão **disabled** com a copy "Em breve. O envio do link ainda não está ativo." Tudo que está mergeado depois da PRD `lancar-despesa` (form de despesa, server actions com RLS) só funciona porque o helper E2E `signInAsFixtureUser` injeta cookies de sessão direto via `signInWithPassword` contra o Supabase local. Sem fluxo real, o casal não consegue usar o app na Vercel — o MVP não sai de localhost.

## Usuário afetado

Tiago e Laine no primeiro acesso pela Vercel a partir do celular (peso alto, é o uso real). Tiago em dev quando quer validar o fluxo de auth real sem cair no atalho do helper (peso médio). Não é pra: signup self-service, usuários novos, recuperação de senha — nada disso existe no produto e não vai existir nesta versão.

## Métrica de sucesso

Com 2 usuários só, a métrica é binária: **Tiago e Laine conseguem entrar no app pela Vercel em iPhone Safari e Chrome Android, sem suporte técnico do Tiago além do compartilhamento inicial da senha**. Verificado manualmente uma vez por usuário no primeiro deploy de produção.

Sem proxy de tempo ou adoção. Latência de `signInWithPassword` é ~200ms — não há ganho em medir. Ou os dois entram, ou a feature falhou.

## Escopo

### Dentro

- `/login` funcional gated por feature flag `AUTH_ENABLED` (env server-only, valores `true`/`false`). Quando ligado: input de email, input de senha, botão **Entrar**. Quando desligado: mantém a UI "Em breve" atual. Default em `.env.example`: `true`. Em produção: começa `false`, vira `true` após smoke test do Tiago.
- Server Action `signInWithEmail({ email, password })` em `src/server/actions/auth/sign-in.ts`. Valida formato (Zod), confere `AUTH_ENABLED`, checa allowlist server-side, chama `supabase.auth.signInWithPassword`. Em sucesso, `@supabase/ssr` seta cookies via `cookies()` e a action retorna `{ ok: true }`. Em erro: mensagem **genérica** sempre — `'Email ou senha inválidos'`. Não distinguir "email não cadastrado" de "senha errada" (evita enumeração de emails válidos).
- Allowlist via env server-only `AUTH_ALLOWED_EMAILS` (csv com 2 entradas). Defense in depth: o Supabase só vai ter esses 2 emails cadastrados de qualquer jeito (provisionamento manual), mas a allowlist garante que qualquer outro email que apareça no banco por engano também é barrado.
- Redirect pós-login: para `/`. Sem destination preservation no v1.
- `/login` com sessão ativa **redireciona pra `/`** (single-account flow, sem "trocar de conta").
- **Middleware** Next.js (`src/middleware.ts`) novo: refresh de sessão a cada request via `@supabase/ssr` e redirect `/login → /` quando já autenticado, redirect `(app)/* → /login` quando anônimo. Substitui o `try { getSession() } catch redirect('/login')` que hoje vive em cada page autenticada. Matcher explícito excluindo `_next/static`, `_next/image`, `favicon.ico` e qualquer rota de assets.
- `tiago@example.com` (fixture user já existente no seed) **fica fora** da allowlist em produção. Em local/dev, a allowlist do `.env.local` inclui o fixture user pra desenvolvimento manual funcionar.
- Helper `signInAsFixtureUser` em `tests/helpers/auth.ts` **renomeado pra `signInAsFixtureUser`** e com JSDoc atualizado: deixa explícito que o helper agora usa **exatamente o mesmo método** (`signInWithPassword`) do caminho de produção — diferença é só pular a UI pra reduzir flake no E2E. Sem mais bypass conceitual; é só economia de DOM. Mantém o caminho em `tests/helpers/auth.ts` (sem mover de pasta).
- Documentação operacional em `docs/operations/provisioning.md` (arquivo novo, curto): passo a passo de como criar usuário novo no Supabase dashboard, definir senha forte, atualizar `AUTH_ALLOWED_EMAILS` no Vercel e em `.env.local`.

### Fora (explicitamente)

- **Magic link / OAuth / SSO**: rejeitado nesta iteração. Custo > benefício pra 2 usuários conhecidos.
- **Signup self-service**: não existe. Adicionar usuário = provisionar manual no dashboard + editar `AUTH_ALLOWED_EMAILS`.
- **Reset de senha via UI** ("esqueci a senha"): não existe. Esqueceu → mensagem pro Tiago → Tiago reseta no dashboard. Aceitável dado que são 2 pessoas.
- **Trocar a própria senha autenticado** (`/conta` com form de update password): possível follow-up, **fora desta PRD**. Não bloqueia uso.
- **2FA / device fingerprint / location check / risk-based auth**: paranoia desnecessária pra 2 usuários conhecidos.
- **"Lembrar de mim" / refresh token longevo customizado**: aceitar default do `@supabase/ssr` (~1h access token, refresh transparente).
- **Logout UI dedicada**: presume-se que existe `/conta` ou botão no header. Esta PRD não cobre — vira PRD separada de "página de conta". A action de signOut pode ser exportada, mas sem UI consumidora.
- **Destination preservation** ("voltar pra rota que tentava acessar após login"): redirect pra `/` direto. Adicionar depois se virar atrito real.
- **Rate limiting custom**: aceitar default do Supabase (`signInWithPassword` tem rate limit nativo no auth server). Não duplicar.

## Abordagem proposta

`/login` vira client component que renderiza o form (quando `AUTH_ENABLED=true`) e chama a Server Action `signInWithEmail`. A action valida o input (Zod), confere a flag, checa allowlist server-side, chama `supabase.auth.signInWithPassword`; o `@supabase/ssr` cuida de persistir cookies via `cookies()`. Em sucesso, `router.push('/')` no cliente. Em erro, mensagem inline genérica.

Middleware `src/middleware.ts` novo. Cada request passa pelo `@supabase/ssr` pra refrescar a sessão (sem ele, o token expira em ~1h e o usuário cai). Rotas `(app)/*` exigem sessão (redirect pra `/login` se anônimo). Rota `/login` redireciona pra `/` se já autenticado. Após o middleware estar verde, remover os `try { getSession() } catch redirect('/login')` espalhados nas pages.

Helper de teste continua existindo porque E2E não vai digitar email/senha em todo teste (overhead de DOM e flake). Mas o nome e o doc explicitam que é equivalência funcional ao fluxo real, não bypass: ambos chamam `signInWithPassword`, ambos resultam nos mesmos cookies. A diferença é só **onde** o submit acontece (Node no helper, browser na UI real).

## Dependências

- **Variável de ambiente `AUTH_ENABLED`** (server-only) em produção (Vercel) e em `.env.local`. Default em `.env.example`: `true`. Em prod: começa `false`.
- **Variável de ambiente `AUTH_ALLOWED_EMAILS`** (server-only) em produção e em `.env.local`. Em prod: `tiago@<dominio-real>,laine@<dominio-real>`. Em local: inclui também `tiago@example.com` (fixture user). Adicionar a `.env.example`.
- **Provisionamento manual no dashboard do Supabase de produção**: Tiago cria 2 usuários (email + senha forte), confirma manualmente (sem fluxo de "confirme seu email"). Tarefa operacional fora do código, mas pré-requisito de uso.
- **`docs/operations/provisioning.md`** novo, descrevendo o passo a passo do provisionamento manual.
- **Nenhuma dependência nova de pacote**: `@supabase/ssr`, `@supabase/supabase-js` e Zod já estão instalados.

## Riscos

- **Senha vazada por um dos dois usuários** (anotada em lugar fácil, reusada de outro serviço comprometido): probabilidade média, impacto alto. Mitigação: Tiago gera senha forte aleatória, recomenda salvar em password manager (Apple Keychain / 1Password). Sem 2FA, é tudo que dá pra fazer sem complicar.
- **Senha esquecida exige intervenção manual do Tiago**: probabilidade média, impacto baixo. Aceitar. Documentado no provisioning.md que "esqueci a senha" = pingar Tiago.
- **Middleware quebra outras rotas em desenvolvimento** (assets estáticos, API routes): probabilidade média se o matcher for amplo demais. Mitigação: matcher explícito pra excluir `_next/static`, `_next/image`, `favicon.ico`, qualquer `api`. Verificar no teste manual antes de mergear.
- **Allowlist desincronizada entre env local e produção** (Laine adicionada em prod mas não em local, ou vice-versa): probabilidade baixa, impacto baixo. Mitigação: documentar em `.env.example` e validar no startup do server (logar warning se a env estiver vazia ou malformada).
- **`AUTH_ENABLED=false` esquecido em prod após smoke pass**: probabilidade média, impacto alto (Laine clica e vê "Em breve" achando que app está quebrado). Mitigação: virar a flag faz parte do checklist de smoke; documentar em provisioning.md.
- **`signInWithPassword` falhando silenciosamente em produção** (config Supabase prod ausente, projeto suspenso, etc): probabilidade baixa, impacto alto. Mitigação: smoke test obrigatório com Tiago no primeiro deploy antes de avisar Laine.
- **Helper renomeado quebra E2E sem ninguém notar**: probabilidade baixa (`tsc --noEmit` pega), impacto baixo. Aceitar.

## Hipóteses a validar

- **"Senha compartilhada via WhatsApp + password manager é seguro o suficiente pra esse contexto"**. Premissa: o casal não vai ter senha vazada de jeito catastrófico em 12 meses. Sem validação proativa — se vazar, troca-se manualmente. Aceitar como tradeoff explícito.
- **"Sem 'lembrar de mim', a sessão padrão de ~1h com refresh transparente é confortável o suficiente pro uso mobile"**. Premissa: o app no celular renova sozinho enquanto o usuário tem aberto; quando volta no dia seguinte, talvez precise re-logar. Validar com 1 semana de uso real. Se o casal estiver re-logando >2x por semana, considerar refresh token mais longo.
- **"Middleware único cobre 100% das rotas autenticadas e elimina o `try/catch` em cada page"**. Premissa: a estrutura de rotas em `(app)/*` é consistente. Validar revisando todas as pages após implementação — se sobrou `getSession` em algum lugar, é redundância.

## Decisões fechadas (de open questions resolvidas)

- **Feature flag pra rollout**: sim, `AUTH_ENABLED` server-only gatekeeps a UI de login. Default true em dev, começa false em prod e vira true após smoke.
- **Mensagem de erro**: sempre genérica (`'Email ou senha inválidos'`). Não enumerar emails válidos.
- **`/login` com sessão ativa**: redireciona pra `/`.
- **Middleware nesta PRD**: sim. Sem ele, "remover o bypass" fica pela metade — cada page mantém `try { getSession() } catch redirect`.
- **Helper de teste**: permanece em `tests/helpers/auth.ts`, renomeado pra `signInAsFixtureUser`.
- **`docs/operations/provisioning.md`**: parte desta PRD. Sem ele, ninguém sabe adicionar o segundo usuário.
