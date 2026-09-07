# Importar fatura do cartão (planilha do banco)

## Problema

Lançar compra a compra do cartão à mão não escala: a fatura real do owner tem ~100 linhas por
mês. Sem elas no app, a fatura do `/cartoes` não bate com a do banco e a sobra prevista fica
otimista. Digitar tudo é inviável; o resultado é abandono do controle do cartão.

## Usuário afetado

owner, uma vez por mês, logo após o fechamento (dia 7): baixa a planilha da fatura no app do
BTG e quer todas as compras dentro do app em menos de um minuto.

## Métrica de sucesso

O total importado bate com o "Total de compras e despesas" do arquivo, e a fatura do app fecha
com o valor do banco no dia 11 (métrica já definida em cartao-credito.md). Proxy: importar a
fatura real de setembro/2026 (~100 compras) sem edição manual.

## Escopo

### Dentro

- Botão "Importar fatura" por cartão em `/cartoes`: arquivo `.xlsx` + senha + categoria padrão
  opcional → pré-visualização (N compras, total, ignoradas, já existentes) → importar.
- Formato suportado: exportação BTG (aba "Titular"; futuras abas de adicionais entram de
  graça — o parser varre todas as abas com o cabeçalho de compras).
- Arquivo criptografado (CDFV2): decripta com a senha via `officecrypto-tool`, lê com `exceljs`.
- Cada linha vira compra pendente do cartão: `purchased_on` = data da linha, `occurred_on` =
  vencimento LIDO do arquivo (não recalculado — o banco inclui compras postadas fora do
  período), moeda BRL obrigatória (conta de pagamento do cartão precisa ser BRL).
- "Parcela sem juros" (n/m) entra como linha da fatura do mês E projeta as parcelas futuras
  (n+1..m) nas faturas seguintes — mesmo valor (sem juros), refs `auth#k/m`. Quando a fatura
  real do mês seguinte for importada, as linhas projetadas já existem e são puladas. Sem criar
  plano em /parcelados.
- Idempotência: `transactions.external_ref` = código de autorização (+ `#n/m` em parcela,
  que repete o código nos meses seguintes), índice único por cartão. Reimportar não duplica.
- Compra lançada à mão com mesma data+valor no cartão é pulada e reportada.
- Créditos/pagamentos/linhas desconhecidas são ignorados e contados no resultado.
- Senha salva em `credit_cards.statement_password` após import com sucesso (decisão do owner).

### Fora (explicitamente)

- Outros bancos/formatos (OFX, CSV, Nubank etc.) — o parser é isolado; formatos novos são
  parsers novos.
- Criar installment_plans a partir de parcelas do arquivo — cada mês importa a própria.
- Auto-categorização por estabelecimento — categoria padrão única no dialog; evolução futura.
- Conciliação de estorno/crédito — ignorado com aviso.
- Import via e-mail/automação — manual, mensal.

## Abordagem

Parser em duas camadas: decrypt+leitura (`officecrypto-tool` + `exceljs`, server-only) produz
uma matriz de células; o mapeamento matriz → fatura é função pura em
`src/lib/finance/btg-statement.ts` (unit-testável sem xlsx). Server action única com
`mode: preview | import`; o preview roda o mesmo core com `dryRun`. Dependências novas
justificadas: são o único par mantido no npm que abre xlsx criptografado.

## Riscos

- BTG mudar o layout: provável a cada redesign, impacto alto → parser ancora nos títulos das
  colunas (não em posições fixas) e falha com erro claro, nunca importa lixo.
- Código de autorização repetido entre compras distintas: raro → o índice único bloquearia a
  segunda; aceito (aparece no contador de "já existentes").
- Ano do vencimento não vem no "11/09": derivado do "Mês/Ano" do cabeçalho com wrap de
  virada de ano (fatura Dezembro/2026 vencendo em janeiro → 2027), com teste dedicado.
- Vencimento real de mês futuro pode divergir do projetado (feriado etc.): a linha projetada
  fica na data projetada e a real é pulada pelo ref — drift de poucos dias, aceito.

## Open questions

- Fatura em atraso importada depois do vencimento entra como "em atraso" automaticamente
  (occurred_on < hoje) — comportamento desejado, registrar e observar.
