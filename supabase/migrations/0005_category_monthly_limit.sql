-- =========================================================================
-- 0005 — Limite mensal por categoria (opcional)
-- Quando definido, /categorias mostra barra de progresso e dashboard
-- alerta quando spent_this_month / limit > 80%.
-- =========================================================================

alter table categories
  add column monthly_limit_cents bigint
    check (monthly_limit_cents is null or monthly_limit_cents > 0);
