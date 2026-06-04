-- =========================================================================
-- 0011 — currency_conversions
--
-- Registro de referência das conversões EUR<->BRL que o owner faz na Wise.
-- NÃO mexe em saldo de conta: serve só de base pro histórico/inteligência de
-- "bom momento para converter". effective_rate (recebido ÷ enviado) captura o
-- spread da Wise implicitamente; mid_market_rate é a taxa BCE do dia, na mesma
-- direção from->to, pra que spread = (mid - effective)/mid saia uniforme nas
-- duas direções.
-- =========================================================================

create table currency_conversions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete restrict,
  from_currency text not null check (from_currency in ('BRL','EUR')),
  to_currency text not null check (to_currency in ('BRL','EUR')),
  from_amount_cents bigint not null check (from_amount_cents > 0),
  to_amount_cents bigint not null check (to_amount_cents > 0),
  effective_rate numeric(14,6) not null check (effective_rate > 0),
  -- Taxa BCE from->to no dia da conversão. Nula se indisponível na captura.
  mid_market_rate numeric(14,6) check (mid_market_rate is null or mid_market_rate > 0),
  converted_on date not null,
  note text,
  created_at timestamptz not null default now(),
  check (from_currency <> to_currency)
);

create index idx_currency_conversions_household
  on currency_conversions(household_id, converted_on desc);

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
alter table currency_conversions enable row level security;

create policy "currency_conversions by household" on currency_conversions
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());
