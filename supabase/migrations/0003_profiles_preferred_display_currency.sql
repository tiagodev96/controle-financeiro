-- Adds per-user preference for which currency is displayed as primary in the
-- dashboard hero (EUR or BRL). Independent of households.base_currency, which
-- remains the "official" currency for accounting purposes.

alter table profiles
  add column preferred_display_currency text not null default 'EUR'
    check (preferred_display_currency in ('EUR', 'BRL'));
