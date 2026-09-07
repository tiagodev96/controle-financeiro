-- =========================================================================
-- 0015 — importação de fatura de cartão (planilha do banco)
--
-- external_ref guarda o código de autorização da compra vindo do arquivo
-- (com sufixo #n/m em parcelas, que repetem o código todo mês). O índice
-- único por cartão torna a reimportação idempotente no banco, não só no
-- código. statement_password guarda a senha padrão das faturas do cartão
-- (protegida pela RLS do household) pra não redigitar a cada import.
-- Detalhes em docs/prds/importar-fatura.md.
-- =========================================================================

alter table credit_cards
  add column statement_password text;

alter table transactions
  add column external_ref text;

create unique index idx_transactions_card_external_ref
  on transactions(credit_card_id, external_ref)
  where credit_card_id is not null and external_ref is not null;
