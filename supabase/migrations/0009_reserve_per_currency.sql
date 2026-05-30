-- =========================================================================
-- 0009 — Reserva multi-moeda
-- A reserva passa a ter uma subconta por moeda (R$ e €), consolidadas no
-- gauge de saúde via câmbio. Troca o índice de "uma reserva por household"
-- pelo de "uma reserva por (household, moeda)".
-- Detalhes em docs/prds/reserva-financeira.md.
-- =========================================================================

drop index if exists idx_envelopes_one_reserve_per_household;

create unique index if not exists idx_envelopes_one_reserve_per_hh_currency
  on envelopes (household_id, currency)
  where is_reserve;
