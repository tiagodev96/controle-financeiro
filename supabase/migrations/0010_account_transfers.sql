-- =========================================================================
-- 0010 — account_transfers + RPCs de pagamento com cobertura
--
-- Quando uma despesa é paga numa conta sem saldo suficiente, o déficit é
-- coberto puxando de outras contas (mesma moeda primeiro, depois conversão).
-- Cada cobertura vira uma linha em account_transfers: debita a origem, credita
-- a conta da despesa. A despesa original fica intacta na sua conta.
--
-- Tudo aplicado via RPC (transação única) pra que despesa + transferências +
-- saldos nunca fiquem pela metade.
-- =========================================================================

create table account_transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete restrict,
  -- Despesa que originou a cobertura. on delete cascade limpa o registro junto;
  -- a reversão de saldo, porém, é feita em código (RPC reverse_payment) antes
  -- do delete — o cascade só remove a linha órfã.
  source_transaction_id uuid references transactions(id) on delete cascade,
  from_account_id uuid not null references accounts(id) on delete restrict,
  to_account_id uuid not null references accounts(id) on delete restrict,
  from_amount_cents bigint not null check (from_amount_cents > 0),
  to_amount_cents bigint not null check (to_amount_cents > 0),
  from_currency text not null check (from_currency in ('BRL','EUR')),
  to_currency text not null check (to_currency in ('BRL','EUR')),
  -- Taxa from_currency→to_currency. Nula em transferência de mesma moeda.
  rate numeric(14,6) check (rate is null or rate > 0),
  occurred_on date not null,
  created_at timestamptz not null default now()
);

create index idx_account_transfers_household on account_transfers(household_id);
create index idx_account_transfers_source on account_transfers(source_transaction_id);

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
alter table account_transfers enable row level security;

create policy "account_transfers by household" on account_transfers
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- -------------------------------------------------------------------------
-- Helper: aplica as transferências de cobertura de uma transação.
-- p_transfers é um array jsonb de
--   { from_account_id, to_account_id, from_amount_cents, to_amount_cents,
--     from_currency, to_currency, rate }
-- SECURITY INVOKER (default): RLS do caller vale, isolamento por household.
-- -------------------------------------------------------------------------
create or replace function apply_coverage_transfers(
  p_txn_id uuid,
  p_occurred_on date,
  p_transfers jsonb
) returns void language plpgsql as $$
declare
  v_household uuid := current_household_id();
  v_profile uuid := auth.uid();
  t jsonb;
  v_from uuid;
  v_to uuid;
  v_from_amt bigint;
  v_to_amt bigint;
begin
  for t in select * from jsonb_array_elements(coalesce(p_transfers, '[]'::jsonb)) loop
    v_from := (t->>'from_account_id')::uuid;
    v_to := (t->>'to_account_id')::uuid;
    v_from_amt := (t->>'from_amount_cents')::bigint;
    v_to_amt := (t->>'to_amount_cents')::bigint;

    if not exists (select 1 from accounts where id = v_from and household_id = v_household)
       or not exists (select 1 from accounts where id = v_to and household_id = v_household) then
      raise exception 'coverage transfer references account outside household';
    end if;

    insert into account_transfers (
      household_id, profile_id, source_transaction_id,
      from_account_id, to_account_id, from_amount_cents, to_amount_cents,
      from_currency, to_currency, rate, occurred_on
    ) values (
      v_household, v_profile, p_txn_id,
      v_from, v_to, v_from_amt, v_to_amt,
      t->>'from_currency', t->>'to_currency',
      case when t->>'rate' is null then null else (t->>'rate')::numeric end,
      p_occurred_on
    );

    update accounts set balance_cents = balance_cents - v_from_amt where id = v_from;
    update accounts set balance_cents = balance_cents + v_to_amt where id = v_to;
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- RPC: cria despesa já paga + aplica cobertura, atômico.
-- Debita a conta da despesa pelo valor cheio; a cobertura credita de volta.
-- -------------------------------------------------------------------------
create or replace function create_paid_transaction_with_coverage(
  p_account_id uuid,
  p_category_id uuid,
  p_direction text,
  p_amount_cents bigint,
  p_currency text,
  p_description text,
  p_occurred_on date,
  p_paid_on date,
  p_transfers jsonb
) returns transactions language plpgsql as $$
declare
  v_txn transactions;
begin
  insert into transactions (
    household_id, profile_id, account_id, category_id, direction,
    amount_cents, currency, description, occurred_on, paid_on, status
  ) values (
    current_household_id(), auth.uid(), p_account_id, p_category_id, p_direction,
    p_amount_cents, p_currency, p_description, p_occurred_on, p_paid_on, 'paid'
  ) returning * into v_txn;

  update accounts
    set balance_cents = balance_cents
      + (case when p_direction = 'income' then p_amount_cents else -p_amount_cents end)
    where id = p_account_id;

  perform apply_coverage_transfers(v_txn.id, p_occurred_on, p_transfers);

  return v_txn;
end $$;

-- -------------------------------------------------------------------------
-- RPC: marca uma transação pendente como paga + aplica cobertura, atômico.
-- -------------------------------------------------------------------------
create or replace function mark_paid_with_coverage(
  p_transaction_id uuid,
  p_paid_on date,
  p_transfers jsonb
) returns void language plpgsql as $$
declare
  v_txn transactions;
begin
  select * into v_txn from transactions where id = p_transaction_id;
  if not found then
    raise exception 'transaction not found';
  end if;

  update transactions
    set status = 'paid', paid_on = p_paid_on
    where id = p_transaction_id;

  update accounts
    set balance_cents = balance_cents
      + (case when v_txn.direction = 'income' then v_txn.amount_cents else -v_txn.amount_cents end)
    where id = v_txn.account_id;

  perform apply_coverage_transfers(p_transaction_id, v_txn.occurred_on, p_transfers);
end $$;

-- -------------------------------------------------------------------------
-- RPC: reverte o pagamento de uma transação — desfaz as transferências de
-- cobertura e, se elas existem, restaura o débito da própria despesa.
--
-- A existência de cobertura prova que o saldo foi aplicado (cobertura só roda
-- em paid + updateBalance). Sem cobertura, não mexe no saldo da despesa —
-- preserva o comportamento atual de delete/desmarcar pra transações simples.
-- -------------------------------------------------------------------------
create or replace function reverse_payment(
  p_transaction_id uuid
) returns void language plpgsql as $$
declare
  v_txn transactions;
  v_has_coverage boolean;
  ct account_transfers;
begin
  select * into v_txn from transactions where id = p_transaction_id;
  if not found then
    return;
  end if;

  select exists (
    select 1 from account_transfers where source_transaction_id = p_transaction_id
  ) into v_has_coverage;

  for ct in
    select * from account_transfers where source_transaction_id = p_transaction_id
  loop
    update accounts set balance_cents = balance_cents + ct.from_amount_cents
      where id = ct.from_account_id;
    update accounts set balance_cents = balance_cents - ct.to_amount_cents
      where id = ct.to_account_id;
  end loop;

  delete from account_transfers where source_transaction_id = p_transaction_id;

  if v_has_coverage and v_txn.status = 'paid' then
    update accounts
      set balance_cents = balance_cents
        + (case when v_txn.direction = 'income' then -v_txn.amount_cents else v_txn.amount_cents end)
      where id = v_txn.account_id;
  end if;
end $$;
