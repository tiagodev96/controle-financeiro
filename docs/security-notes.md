# Notas de segurança e dados

Este repositório é público. Pra garantir que nada sensível vaza, e pra orientar quem for forkar pra uso real, valem as práticas abaixo.

## O que está no `.gitignore`

* `.env.local` (URLs e chaves do seu Supabase real, emails da allowlist com nome próprio).
* `supabase/.branches/` e `supabase/.temp/` (working dirs do Supabase CLI).
* `playwright-report/`, `test-results/`, `coverage/`.
* `.claude/` (preferências locais do Claude Code).
* `.next/` (build artifacts).

## Convenções nos arquivos versionados

* **`supabase/seed.sql` usa placeholders** (`owner@example.com`, household "Household Demo"). Nunca coloque emails reais aqui.
* **`.env.example` usa placeholders** (`you@example.com`, `partner@example.com`). Mesmo padrão.
* **`NEXT_PUBLIC_ALLOWED_EMAILS` é exposto no bundle do client** por design. É uma allowlist defensiva, não um segredo. A barreira real contra acesso não autorizado é o Auth Hook do Supabase + RLS, não esse env var.

## Hardening recomendado antes de ir pra produção

1. Substituir a checagem de allowlist no client por um **Auth Hook server side** no Supabase. Aí dá pra remover a versão pública de `NEXT_PUBLIC_ALLOWED_EMAILS` por completo.
2. Auditar as policies de RLS rodando consultas com cada user role (anon, authenticated, service_role) e confirmando o isolamento entre households.
3. Rotacionar `SUPABASE_SERVICE_ROLE_KEY` antes do primeiro deploy. Essa chave dá acesso total ao banco e nunca pode aparecer no bundle do client.
4. Gerar um Supabase project novo (não reutilizar nenhum existente) e configurar o Vercel apontando pra ele.
5. Trocar todos os emails do `.env.local` antes do deploy.

## Modelo de dados

* RLS habilitado em todas as tabelas do domínio. Cada household só lê os próprios dados (`current_household_id()` retorna o household do usuário autenticado).
* Dinheiro **sempre em centavos** (inteiros) no banco. Float está banido.
* `auth.users` tem cascade pra `profiles`, então deletar um usuário no Supabase Auth derruba o profile e tudo que pendura nele.

## Reporte de vulnerabilidades

Este é um projeto pessoal sem programa formal de divulgação. Se você encontrar algo sério (vazamento de chave, bypass de RLS, etc), abra um issue privado pelo GitHub Security Advisories ou entre em contato direto pelo perfil do mantenedor.
