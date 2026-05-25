-- =========================================================================
-- Adiciona UNIQUE(household_id, name) em accounts — paralelo ao que já existe
-- em categories. Bloqueia 2 contas com mesmo nome no mesmo household, evita
-- ambiguidade nas listagens.
-- =========================================================================

alter table accounts
  add constraint accounts_household_id_name_key unique (household_id, name);
