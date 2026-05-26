-- =========================================================================
-- 0006 — Caixinhas (envelopes virtuais)
-- Divide o saldo manual em "potes mentais": "esse dinheiro é da viagem",
-- "esse é reserva". Não afeta accounts.balance_cents — é só uma visão
-- do que o owner mentalmente já comprometeu.
--
-- "Saldo livre" pra uma currency = sum(accounts.balance) - sum(envelopes.current)
-- =========================================================================

create table envelopes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  currency text not null check (currency in ('BRL','EUR')),
  target_cents bigint check (target_cents is null or target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index idx_envelopes_household on envelopes (household_id);
create index idx_envelopes_currency on envelopes (household_id, currency);

create trigger trg_envelopes_updated
  before update on envelopes
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
alter table envelopes enable row level security;

create policy "envelopes by household" on envelopes
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());
