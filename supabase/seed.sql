-- =========================================================================
-- Seed local: 1 household, 1 profile e 2 contas vazias.
-- Rodado automaticamente em `supabase db reset` e no primeiro `supabase start`.
-- IDs fixos para os testes E2E/integração poderem referenciar diretamente.
-- =========================================================================

-- usuário base no auth.users (Supabase local; senha não importa em local)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'tiago@example.com',
  crypt('password-local', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

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
