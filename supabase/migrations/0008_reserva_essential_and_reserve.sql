-- =========================================================================
-- 0008 — Reserva financeira
-- Marca categorias essenciais (base do custo de vida que dimensiona a reserva)
-- e designa qual caixinha é a reserva rastreada pelo gauge de saúde.
-- Detalhes em docs/prds/reserva-financeira.md.
--
-- Aditiva: ambas as colunas nascem `false`, sem reescrever linhas existentes.
-- O índice parcial começa vazio (nenhuma caixinha é reserva por default).
-- =========================================================================

alter table categories
  add column is_essential boolean not null default false;

alter table envelopes
  add column is_reserve boolean not null default false;

-- No máximo uma caixinha de reserva por household.
create unique index idx_envelopes_one_reserve_per_household
  on envelopes (household_id)
  where is_reserve;
