-- =========================================================================
-- 0014 — credit_cards
--
-- Cartão de crédito NÃO é uma account: account é carteira com saldo manual, e
-- esse saldo entra inteiro na projeção de fim de mês. Um cartão ali obrigaria
-- a excluí-lo de todos os pontos de soma, e cada esquecimento viraria erro
-- silencioso no saldo.
--
-- O cartão é uma etiqueta na transaction: account_id segue apontando pra conta
-- que PAGA a fatura, credit_card_id marca a compra, purchased_on guarda a data
-- real e occurred_on recebe o VENCIMENTO da fatura do ciclo. Assim a compra já
-- nasce como despesa pendente do mês em que o dinheiro sai e a projeção
-- continua correta sem mudança.
--
-- Fatura não tem tabela: é o conjunto de transactions do cartão com o mesmo
-- occurred_on — mesma filosofia de "parcela é transaction com installment_number".
-- Detalhes em docs/prds/cartao-credito.md.
-- =========================================================================

create table credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  -- Dia em que o ciclo fecha (exclusivo): compras a partir dele caem na fatura
  -- seguinte. Com closing_day = 7, o melhor dia pra comprar é o próprio dia 7.
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  credit_limit_cents bigint check (credit_limit_cents is null or credit_limit_cents > 0),
  -- Conta debitada ao pagar a fatura. Define também a moeda das compras.
  payment_account_id uuid not null references accounts(id) on delete restrict,
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index idx_credit_cards_household on credit_cards(household_id);

create trigger trg_credit_cards_updated before update on credit_cards
  for each row execute function set_updated_at();

alter table credit_cards enable row level security;

create policy "credit_cards by household" on credit_cards
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- -------------------------------------------------------------------------
-- transactions: etiqueta de cartão + data real da compra
-- -------------------------------------------------------------------------
alter table transactions
  add column credit_card_id uuid references credit_cards(id) on delete set null,
  add column purchased_on date,
  -- Compra de cartão sem data de compra não teria como ser atribuída a um ciclo.
  add constraint transactions_card_purchase_date
    check (credit_card_id is null or purchased_on is not null);

create index idx_transactions_card on transactions(credit_card_id, occurred_on)
  where credit_card_id is not null;

alter table installment_plans
  add column credit_card_id uuid references credit_cards(id) on delete set null;

-- -------------------------------------------------------------------------
-- RPC: paga a fatura inteira de um vencimento — marca as compras pendentes
-- como pagas e debita a conta UMA vez pelo total, atômico.
-- Retorna o total pago; 0 quando não havia nada pendente (idempotente).
-- SECURITY INVOKER (default): RLS do caller vale, isolamento por household.
-- -------------------------------------------------------------------------
create or replace function pay_credit_card_invoice(
  p_card_id uuid,
  p_due_date date,
  p_paid_on date,
  p_account_id uuid,
  p_update_balance boolean
) returns bigint language plpgsql as $$
declare
  v_total bigint;
begin
  -- Valida a conta ANTES de marcar as compras: um update de saldo que afeta 0
  -- linhas (conta inexistente ou de outro household, invisível via RLS)
  -- deixaria as compras pagas sem débito, silenciosamente.
  if p_update_balance and not exists (select 1 from accounts where id = p_account_id) then
    raise exception 'conta % não encontrada', p_account_id;
  end if;

  -- Total derivado do próprio UPDATE: dois pagamentos concorrentes da mesma
  -- fatura não podem debitar duas vezes — o segundo marca 0 linhas e soma 0.
  with updated as (
    update transactions
      set status = 'paid', paid_on = p_paid_on
    where credit_card_id = p_card_id
      and occurred_on = p_due_date
      and status = 'pending'
    returning amount_cents
  )
  select coalesce(sum(amount_cents), 0) into v_total from updated;

  if v_total = 0 then
    return 0;
  end if;

  if p_update_balance then
    update accounts
      set balance_cents = balance_cents - v_total
    where id = p_account_id;
  end if;

  return v_total;
end $$;
