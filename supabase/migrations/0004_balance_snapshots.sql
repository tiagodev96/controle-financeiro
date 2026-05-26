-- =========================================================================
-- 0004 — account_balance_snapshots
-- Histórico semanal do saldo das contas. Cron captura toda madrugada de
-- domingo (source='auto'); owner pode ajustar ou inserir manualmente via
-- /contas → Histórico (source='manual').
-- =========================================================================

create table account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  snapshot_date date not null,
  balance_cents bigint not null,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);

-- Lookup principal: "qual o snapshot mais recente <= data X pra essa account?"
create index idx_balance_snapshots_account_date
  on account_balance_snapshots (account_id, snapshot_date desc);

-- Filtros por household (RLS + listagens).
create index idx_balance_snapshots_household
  on account_balance_snapshots (household_id);

create trigger trg_balance_snapshots_updated
  before update on account_balance_snapshots
  for each row execute function set_updated_at();

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
alter table account_balance_snapshots enable row level security;

create policy "snapshots by household" on account_balance_snapshots
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());
