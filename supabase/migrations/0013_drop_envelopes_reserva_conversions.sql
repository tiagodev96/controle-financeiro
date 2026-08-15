-- Remove caixinhas (envelopes), reserva e histórico de conversões de moeda.
-- Índices, triggers e policies caem junto com as tabelas.
-- Destrutivo: os dados dessas features não são recuperáveis.
drop table if exists envelopes cascade;
drop table if exists currency_conversions cascade;

-- Marcação de categoria essencial só existia pro cálculo da reserva.
alter table categories drop column if exists is_essential;
