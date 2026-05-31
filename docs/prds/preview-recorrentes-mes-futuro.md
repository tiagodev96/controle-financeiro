# Preview virtual de recorrentes em mês futuro

## Problema

Ao navegar para um mês futuro (ex: agosto, setembro), o usuário vê a **sobra projetada** já considerando as recorrentes (salário, assinaturas), mas a **lista de transações daquele mês não mostra essas recorrentes** — elas só viram linha no banco quando o cron gera, no dia 1 do mês corrente. Resultado: o número do card não reconcilia com nenhuma lista visível. O usuário não consegue responder "do que é feito o saldo projetado de setembro?" olhando as transações — só aparecem as parcelas (que são linhas reais criadas adiantadas). A composição do custo futuro fica opaca.

## Usuário afetado

Owner (e demais membros do household) durante **planejamento/projeção**, navegando meses à frente — peso maior no **dashboard** (visão rápida no celular) e na **página /transações** (conferir todos os custos do mês). Não afeta o uso do mês corrente nem lançamento do dia a dia.

## Métrica de sucesso

Sem métrica de produto (app pessoal, 2 usuários). Critério de aceite objetivo:

- **Reconciliação:** a soma das despesas/entradas exibidas (reais + previstas) num mês futuro bate **exatamente** com os componentes da sobra projetada do card (mesma fonte de virtualização).
- **Clareza:** o usuário identifica visualmente o que é "previsto" (recorrente ainda não gerada) vs "real" (parcela/lançamento) sem ambiguidade.

## Escopo

### Dentro

- Em **mês futuro**, injetar as recorrentes ativas daquele mês como linhas **"previsto"** (virtuais, sem gravar no banco) em:
  - bloco "Transações recentes" do **dashboard**;
  - lista da página **/transações** (modo mês).
- Linhas previstas **somam nos totais** exibidos (despesa/entrada por moeda e total convertido) e na contagem de lançamentos.
- Linhas previstas são **read-only**: sem marcar pago, editar ou excluir.
- Tag visual de **"previsto"**, distinta das tags atuais "recorrente" e "parcela N/M".
- **Fonte única:** a virtualização vem do mesmo helper usado pela sobra projetada (`month-projection`), pra lista e card nunca divergirem. Extrair helper compartilhado se necessário.
- Data de cada linha prevista = `day_of_month` da regra, clampado ao último dia do mês alvo.

### Fora (explicitamente)

- **Não materializar nada no banco** para meses futuros. Geração no banco continua só do mês corrente (cron `0 3 1 * *` + sweep retroativo).
- **Não** gerar meses futuros adiantadamente nem mudar o cron.
- **Parcelas futuras** já são linhas reais (criadas no plano) — continuam reais, não viram virtuais.
- **Modo "intervalo" de datas** (range arbitrário que cruza meses) na /transações **não** injeta previstos na v1 — só o modo mês. (Ver open questions.)
- **Mês corrente** continua mostrando só linhas reais. Não cobrir o caso "dia 1 antes do cron rodar" nesta v1.
- Editar/pagar/converter uma linha prevista em real com 1 clique — fora da v1.

## Abordagem proposta

Helper server-side que, dado um household + mês futuro, retorna as ocorrências virtuais das recorrentes ativas não geradas (reaproveitando a lógica de `projectMonthForFuture`: regras ativas no mês, dedupe por `source_recurring_rule_id` já gerado, conversão de moeda). As ocorrências têm o shape de uma transação + flag `previsto: true` (sem `id` de banco). As superfícies (dashboard `BottomBlock`, página `/transações`) concatenam essas linhas às reais, ordenando por data, e incluem nos totais. `TxnRow`/`TransactionsList` renderizam estado "previsto" read-only quando a flag está presente.

Só aplica quando o mês alvo é **estritamente futuro** (`isFuture`), reusando a mesma checagem já existente nas páginas.

## Dependências

Nenhuma nova. Depende de extrair/!reusar a virtualização de recorrentes hoje embutida em `src/lib/finance/month-projection.ts` como fonte única.

## Riscos

- **Filtros da /transações interagem mal com virtuais** (status/categoria/conta/intervalo): item previsto não tem `id` nem é "pago"/"pendente" no sentido do banco. Média prob × médio impacto → definir regras explícitas de filtro (ver open questions) e cobrir por teste.
- **Divergência lista × card:** se a lista virtualizar por conta própria, os números não batem. Médio × alto → fonte única obrigatória (helper compartilhado), com teste de reconciliação.
- **Confusão visual real vs previsto:** usuário acha que já "aconteceu". Médio × médio → tag clara + sem ações + estilo distinto (esmaecido/itálico, a definir no design).
- **Paginação/contagem:** /transações tem "mostrando X de Y" e limite — misturar virtuais (sem paginação real) pode confundir a contagem. Baixo × médio → tratar virtuais como bloco à parte na contagem, ou documentar o comportamento.

## Hipóteses a validar

- Assumimos que o usuário quer ver as recorrentes previstas **como linhas individuais** (não só um agregado "recorrentes: €X"). Se um resumo agregado bastasse, o custo cai bastante. (Sinalizado pelo próprio pedido — alta confiança, mas vale confirmar o nível de detalhe esperado.)

## Decisões (resolvidas)

- **Modo intervalo (range de datas):** v1 **não** injeta previstos — só o modo mês. Em modo intervalo a lista segue só com reais.
- **Filtros (refinado na implementação):** previstos aparecem só em **modo mês** de mês futuro e **sem narrowing por status ou conta** (ao filtrar status=pago/pendente ou uma conta específica, mostra só linhas reais — evita misturar previsto, que não tem status nem conta resolvível, com um recorte de dados reais). Filtros de **categoria** e **busca** aplicam normalmente às linhas previstas.
- **Nível de detalhe:** **uma linha por recorrente** (não agregado).
- **Estilo visual:** linha esmaecida + badge **"previsto"** distinto das tags "recorrente"/"parcela", sem botões de ação. Refinar tokens na fase de UI seguindo o design-system.
