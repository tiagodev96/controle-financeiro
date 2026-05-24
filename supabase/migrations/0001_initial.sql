-- =========================================================================
-- Controle Financeiro — Migration inicial
-- Rodar no Supabase SQL Editor (ou via supabase migration new + supabase db push)
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Helper: updated_at trigger
-- -------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -------------------------------------------------------------------------
-- households
-- -------------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'BRL' check (base_currency in ('BRL','EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_households_updated before update on households
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- -------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_household on profiles(household_id);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- helper para usar em RLS
create or replace function current_household_id()
returns uuid language sql stable security definer as $$
  select household_id from profiles where id = auth.uid()
$$;

-- -------------------------------------------------------------------------
-- accounts (contas / carteiras, multi-moeda)
-- -------------------------------------------------------------------------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  currency text not null check (currency in ('BRL','EUR')),
  balance_cents bigint not null default 0,
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_accounts_household on accounts(household_id);
create trigger trg_accounts_updated before update on accounts
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- categories (gerenciadas pelo usuário)
-- -------------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text,                              -- nome do ícone Lucide (ex: "home", "shopping-cart")
  color_hint text,                        -- hex opcional pra customizar hue
  kind text not null default 'expense' check (kind in ('expense','income','transfer')),
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);
create index idx_categories_household on categories(household_id);
create trigger trg_categories_updated before update on categories
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- recurring_rules (despesas/entradas que se repetem todo mês)
-- -------------------------------------------------------------------------
create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  amount_cents bigint not null,
  currency text not null check (currency in ('BRL','EUR')),
  direction text not null check (direction in ('expense','income')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  day_of_month int not null check (day_of_month between 1 and 31),
  frequency text not null default 'monthly' check (frequency in ('monthly','yearly')),
  active_from date not null default current_date,
  active_until date,
  is_paused boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_recurring_household on recurring_rules(household_id) where not is_paused;
create trigger trg_recurring_updated before update on recurring_rules
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- installment_plans (compras parceladas com datas previstas)
-- -------------------------------------------------------------------------
create table installment_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  total_amount_cents bigint not null,
  currency text not null check (currency in ('BRL','EUR')),
  total_installments int not null check (total_installments > 0),
  first_due_date date not null,
  frequency_months int not null default 1 check (frequency_months > 0),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_installment_household on installment_plans(household_id);
create trigger trg_installment_updated before update on installment_plans
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- debts (dívidas flexíveis — sem data fixa, pagar quando der)
-- -------------------------------------------------------------------------
create table debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  original_amount_cents bigint not null check (original_amount_cents > 0),
  remaining_amount_cents bigint not null,    -- atualizado via trigger quando há pagamento
  currency text not null check (currency in ('BRL','EUR')),
  priority smallint not null default 2 check (priority between 1 and 3),  -- 1=alta, 2=média, 3=baixa
  target_installments int,                   -- "queria pagar em 2x"
  target_quit_date date,                     -- "até dez/26"
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index idx_debts_household_open on debts(household_id) where status = 'open';
create trigger trg_debts_updated before update on debts
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- transactions (entrada/saída, podem vir de recurring/installment/debt)
-- -------------------------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete restrict,  -- quem lançou
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  direction text not null check (direction in ('expense','income')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency in ('BRL','EUR')),
  description text not null,
  occurred_on date not null,                 -- data esperada / vencimento
  paid_on date,                              -- quando efetivamente pago (null = pendente)
  status text not null default 'pending' check (status in ('pending','paid')),
  -- vínculos opcionais com a origem
  source_recurring_rule_id uuid references recurring_rules(id) on delete set null,
  source_installment_plan_id uuid references installment_plans(id) on delete set null,
  installment_number int,                    -- 3, em "parcela 3/10"
  source_debt_id uuid references debts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- garante coerência paid <=> paid_on preenchido
  check ((status = 'paid' and paid_on is not null) or (status = 'pending' and paid_on is null))
);
create index idx_transactions_household_date on transactions(household_id, occurred_on desc);
create index idx_transactions_status on transactions(household_id, status, occurred_on);
create index idx_transactions_recurring on transactions(source_recurring_rule_id) where source_recurring_rule_id is not null;
create index idx_transactions_installment on transactions(source_installment_plan_id) where source_installment_plan_id is not null;
create index idx_transactions_debt on transactions(source_debt_id) where source_debt_id is not null;
create trigger trg_transactions_updated before update on transactions
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- Trigger: atualiza debts.remaining_amount_cents quando há pagamento
-- -------------------------------------------------------------------------
create or replace function recalc_debt_remaining()
returns trigger language plpgsql as $$
declare
  tgt_debt_id uuid;
begin
  -- pega o debt afetado (pode ser do OLD em delete/update, do NEW caso contrário)
  tgt_debt_id := coalesce(new.source_debt_id, old.source_debt_id);
  if tgt_debt_id is null then return coalesce(new, old); end if;

  update debts
    set remaining_amount_cents = greatest(
      original_amount_cents - coalesce((
        select sum(amount_cents)
        from transactions
        where source_debt_id = tgt_debt_id and status = 'paid'
      ), 0),
      0
    ),
    status = case
      when (original_amount_cents - coalesce((
        select sum(amount_cents)
        from transactions
        where source_debt_id = tgt_debt_id and status = 'paid'
      ), 0)) <= 0 then 'closed'
      else 'open'
    end,
    closed_at = case
      when (original_amount_cents - coalesce((
        select sum(amount_cents)
        from transactions
        where source_debt_id = tgt_debt_id and status = 'paid'
      ), 0)) <= 0 then now()
      else null
    end
  where id = tgt_debt_id;

  return coalesce(new, old);
end $$;

create trigger trg_debt_payment_insert
  after insert on transactions
  for each row when (new.source_debt_id is not null)
  execute function recalc_debt_remaining();

create trigger trg_debt_payment_update
  after update on transactions
  for each row when (
    new.source_debt_id is not null or old.source_debt_id is not null
  )
  execute function recalc_debt_remaining();

create trigger trg_debt_payment_delete
  after delete on transactions
  for each row when (old.source_debt_id is not null)
  execute function recalc_debt_remaining();

-- -------------------------------------------------------------------------
-- fx_rates_cache (cotações EUR/BRL via frankfurter.app, cache diário)
-- -------------------------------------------------------------------------
create table fx_rates_cache (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  base text not null check (base in ('BRL','EUR')),
  quote text not null check (quote in ('BRL','EUR')),
  rate numeric(14,6) not null check (rate > 0),
  fetched_at timestamptz not null default now(),
  unique (rate_date, base, quote)
);
create index idx_fx_lookup on fx_rates_cache(base, quote, rate_date desc);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table households       enable row level security;
alter table profiles         enable row level security;
alter table accounts         enable row level security;
alter table categories       enable row level security;
alter table recurring_rules  enable row level security;
alter table installment_plans enable row level security;
alter table debts            enable row level security;
alter table transactions     enable row level security;
alter table fx_rates_cache   enable row level security;

-- households: usuário só vê o próprio
create policy "households self" on households
  for all using (id = current_household_id())
  with check (id = current_household_id());

-- profiles: você lê seu próprio + parceiro(a) do mesmo household
create policy "profiles same household" on profiles
  for select using (household_id = current_household_id());
create policy "profiles self update" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- accounts/categories/recurring/installment/debts/transactions: por household
create policy "accounts by household" on accounts
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "categories by household" on categories
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "recurring by household" on recurring_rules
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "installment by household" on installment_plans
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "debts by household" on debts
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "transactions by household" on transactions
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- fx_rates_cache: leitura aberta a usuários autenticados, escrita só via service role
create policy "fx read" on fx_rates_cache
  for select using (auth.role() = 'authenticated');
-- (insert/update vai via service_role key num Server Action)

-- =========================================================================
-- VIEWS úteis
-- =========================================================================

-- Saldo total do household, convertido pra moeda base, usando última cotação disponível
create or replace view v_account_totals as
  select
    a.household_id,
    a.currency,
    sum(a.balance_cents) as balance_cents
  from accounts a
  where not a.is_archived
  group by a.household_id, a.currency;

-- Resumo do mês corrente: pago, pendente, em atraso, sobra
create or replace view v_month_summary as
  with base as (
    select
      household_id,
      currency,
      direction,
      status,
      case when status = 'pending' and occurred_on < current_date then true else false end as is_overdue,
      amount_cents,
      occurred_on
    from transactions
    where date_trunc('month', occurred_on) = date_trunc('month', current_date)
  )
  select
    household_id,
    currency,
    sum(case when direction = 'income' and status = 'paid' then amount_cents else 0 end) as income_paid_cents,
    sum(case when direction = 'income' and status = 'pending' then amount_cents else 0 end) as income_pending_cents,
    sum(case when direction = 'expense' and status = 'paid' then amount_cents else 0 end) as expense_paid_cents,
    sum(case when direction = 'expense' and status = 'pending' and not is_overdue then amount_cents else 0 end) as expense_pending_cents,
    sum(case when direction = 'expense' and is_overdue then amount_cents else 0 end) as expense_overdue_cents
  from base
  group by household_id, currency;
