-- =========================================================================
-- 0007 — limit_currency em categorias
-- Categoria é household-wide, mas o limite precisa ser comparado em uma
-- moeda única (EUR ou BRL). Helper soma gastos de TODAS as currencies e
-- converte cada um pra limit_currency via fxRateMap antes de comparar.
-- =========================================================================

alter table categories
  add column limit_currency text
    check (limit_currency is null or limit_currency in ('EUR','BRL'));

-- Backfill: categorias que já tinham limite (definido pré-essa migration)
-- vinham implicitamente em EUR.
update categories
  set limit_currency = 'EUR'
  where monthly_limit_cents is not null
    and limit_currency is null;
