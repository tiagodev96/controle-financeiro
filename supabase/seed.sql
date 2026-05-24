-- =========================================================================
-- Seed local: 1 household, 1 profile e 2 contas vazias.
-- Rodado automaticamente em `supabase db reset` e no primeiro `supabase start`.
-- IDs fixos para os testes E2E/integração poderem referenciar diretamente.
-- =========================================================================

-- usuário base no auth.users (Supabase local; senha não importa em local).
-- Setamos confirmation_token / recovery_token / email_change_token_new como
-- string vazia explícita porque o GoTrue v2.188+ não tolera NULL nessas
-- colunas (sql Scan error on column "confirmation_token"). As outras 3
-- colunas de token já têm default ''.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'tiago@example.com',
  crypt('password-local', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', ''
)
on conflict (id) do nothing;

-- Identity para o provider 'email'. Sem essa linha, signInWithPassword falha
-- com "Database error querying schema" no GoTrue moderno do Supabase.
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000001',
    'email', 'tiago@example.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

-- household
insert into households (id, name, base_currency)
values ('11111111-1111-4111-8111-111111111111', 'Household Demo', 'EUR')
on conflict (id) do nothing;

-- profile (FK em auth.users)
insert into profiles (id, household_id, display_name)
values (
  '00000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Owner'
)
on conflict (id) do nothing;

-- 2 contas compartilhadas (uma por moeda). O household é o escopo único;
-- todos os profiles dentro dele veem o mesmo fluxo de caixa.
insert into accounts (id, household_id, name, currency, balance_cents, sort_order)
values
  ('22222222-2222-4222-8222-222222222001', '11111111-1111-4111-8111-111111111111', 'Conta principal EUR', 'EUR', 0, 1),
  ('22222222-2222-4222-8222-222222222002', '11111111-1111-4111-8111-111111111111', 'Conta principal BRL', 'BRL', 0, 2)
on conflict (id) do nothing;

-- 6 categorias default de despesa. IDs fixos pra testes E2E/integração.
-- Cobre os usos mais comuns no início. Usuário pode editar/arquivar depois.
insert into categories (id, household_id, name, kind, sort_order)
values
  ('33333333-3333-4333-8333-333333333001', '11111111-1111-4111-8111-111111111111', 'Mercado',     'expense', 1),
  ('33333333-3333-4333-8333-333333333002', '11111111-1111-4111-8111-111111111111', 'Restaurante', 'expense', 2),
  ('33333333-3333-4333-8333-333333333003', '11111111-1111-4111-8111-111111111111', 'Transporte',  'expense', 3),
  ('33333333-3333-4333-8333-333333333004', '11111111-1111-4111-8111-111111111111', 'Moradia',     'expense', 4),
  ('33333333-3333-4333-8333-333333333005', '11111111-1111-4111-8111-111111111111', 'Lazer',       'expense', 5),
  ('33333333-3333-4333-8333-333333333006', '11111111-1111-4111-8111-111111111111', 'Outros',      'expense', 6)
on conflict (id) do nothing;

-- =========================================================================
-- Fixture E2E pro estado vazio (E3): household sem categorias, com conta.
-- User "empty@example.com" / password-local. NÃO compartilha household com
-- Tiago — RLS isola tudo. Existe SÓ pra exercitar o empty state de /lancar
-- sem precisar truncar categories do household principal durante o teste.
-- =========================================================================
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'empty@example.com',
  crypt('password-local', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000002',
    'email', 'empty@example.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

insert into households (id, name, base_currency)
values ('44444444-4444-4444-8444-444444444444', 'Household Vazio', 'EUR')
on conflict (id) do nothing;

insert into profiles (id, household_id, display_name)
values (
  '00000000-0000-4000-8000-000000000002',
  '44444444-4444-4444-8444-444444444444',
  'Empty Fixture'
)
on conflict (id) do nothing;

insert into accounts (id, household_id, name, currency, balance_cents, sort_order)
values
  ('22222222-2222-4222-8222-222222222003', '44444444-4444-4444-8444-444444444444', 'Conta vazia', 'EUR', 0, 1)
on conflict (id) do nothing;
