-- Aporte mensal combinado por caixinha (PRD aporte-caixinhas).
-- Nullable: caixinha sem aporte definido segue como hoje.
alter table envelopes
  add column monthly_contribution_cents bigint
  check (monthly_contribution_cents is null or monthly_contribution_cents > 0);
