-- =========================================================================
-- 0016 — recorrente paga no cartão
--
-- Assinatura cobrada na fatura (ex: Google One) é uma recurring_rule com
-- credit_card_id: a geração mensal vira COMPRA DE CARTÃO (purchased_on = dia
-- da cobrança, occurred_on = vencimento da fatura do ciclo, conta = a que
-- paga a fatura). O dinheiro só sai no "Pagar fatura", e o import do xlsx
-- deduplica a cobrança pelo par valor + data (±3 dias).
-- =========================================================================

alter table recurring_rules
  add column credit_card_id uuid references credit_cards(id) on delete set null;
