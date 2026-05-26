# Parcelados (installment_plans)

## Problema

Tiago compra coisas parceladas com regularidade (notebook em 12×, curso em 6×, móvel em 10×) e hoje precisa lançar cada parcela manualmente toda vez que vence. Três efeitos:

1. **Esquecimento**: ele lança 1-2 parcelas, depois desiste. Saldo previsto fica errado.
2. **Sobra prevista otimista**: parcelas futuras pendentes não entram na projeção até serem manualmente lançadas.
3. **Sem visibilidade do progresso**: não consegue ver "estou na parcela 4/12 do notebook".

## Usuário afetado

- **Tiago cadastrando parcelado novo** (peso médio, frequência mensal): "comprei sofá em 10× de R$ 480, primeira parcela 15 de junho".
- **Tiago/Laine pagando parcela** (peso alto, semanal): igual transação pendente — marca como paga em /transacoes.
- **Tiago visualizando progresso** (peso baixo, eventual): "quantas parcelas faltam do notebook?".

Não é pra: dívidas flexíveis sem cronograma (já coberto por /dividas), assinaturas mensais sem fim (recurring rules), gastos one-off (/lancar).

## Métrica de sucesso

**Toda compra parcelada de Tiago dos últimos 60 dias está cadastrada em /parcelados dentro de 1 semana após deploy** + **parcelas geradas aparecem em /transacoes sem precisar relançar manualmente**. Medido por sample de 2-3 parcelados reais.

Proxy direto: 2 planos criados na primeira semana, todas as parcelas geradas e marcadas como pendentes.

## Escopo

### Dentro

**CRUD de planos** (pattern recurring/dividas):
- `/parcelados` lista planos com seções **Em andamento** (alguma parcela pending) e **Quitados** (todas paid).
- Dialog "Novo parcelado": title, valor total (MoneyInput), currency (toggle EUR/BRL), `total_installments` (input number 2-60), `first_due_date`, `frequency_months` (default 1, raramente mexe), categoria, conta, notas opcional.
- Card de cada plano mostra: title, "parcela X/N", valor da parcela (`total / N`), conta+categoria, progress bar (pagas/total), menu ••• com: Editar (só title, category, account, notes — não estrutura), Cancelar (deleta plano; transactions pending viram standalone via `on delete set null`).

**Geração automática ao criar plano**:
- Server action `createInstallmentPlanCore` insere o plano + N transactions pendentes em uma operação (não strict transaction — se falhar metade, log warning).
- Cada parcela: `occurred_on = first_due_date + (i-1) * frequency_months meses`, `amount_cents = round(total / N)`, última ajusta o resto. Sem ajuste de timezone: usa date arithmetic em local time, schema é `date` (sem timezone).
- `source_installment_plan_id` + `installment_number` populados.
- Transactions geradas: `status='pending'`, `paid_on=null`, currency=plan.currency.

**Visibilidade**:
- /transacoes não muda v1 (parcelas aparecem como pending normais). PRD futura: pill "PARC 3/10".

### Fora (explicitamente)

- **Editar valor/N/datas de plano existente** — não. Cancela e recria. Editar estrutura quebraria parcelas já marcadas como pagas (recalcular valores complica).
- **Frequência custom além de meses** (semanal, quinzenal) — não. Schema permite, UI v1 só `frequency_months`.
- **Ajuste de arredondamento custom da última parcela** — sem opção; soma confere com `total_amount_cents`.
- **Trigger DB pra recalcular plano após pagamentos** — não. Plano não tem "remaining"; status é derivado das transactions ligadas.
- **Sugestão automática** ("você gastou R$ 500 três vezes seguidas em loja X, virou parcelado?") — analytics futura.
- **Currency mismatch entre plan.currency e account.currency** — UI v1 bloqueia (mesma regra de pagamento de dívida).
- **Dashboard card "Próximas parcelas dos próximos 7 dias"** — já coberto pela seção genérica de "próximos vencimentos" se entrar.
- **Soft delete** — hard delete (consistência com dívidas/recurring).

## Abordagem proposta

Mesmo pattern: page server-component, dialog client de criar, list-item client com menu •••. Server actions em `src/server/actions/installments/`:
- `core.ts` — createInstallmentPlanCore (atomicidade simples: INSERT plan → bulk INSERT transactions; se segunda falha, DELETE plan + erro), deleteInstallmentPlanCore, updateInstallmentPlanCore.
- `actions.ts` — wrappers.

Helper `listInstallmentPlansForHousehold` em `src/lib/finance/installments.ts` retorna `{ active, finished, planById }` com count de parcelas pagas/total via aggregate.

## Dependências

- **Schema**: pronto (table + transaction columns + FK on delete set null).
- **RLS**: `installment by household` já existente.
- **Pattern de UI**: herdado de recurring/dividas.

## Riscos

- **Bulk insert das N parcelas falhar parcialmente**: probabilidade baixa (Supabase atomic insert), impacto médio (plano órfão). Mitigação: se INSERT em batch retorna error, rollback manual deletando o plano. Aceitar leak raro.
- **first_due_date no passado**: probabilidade média (Tiago lembra de cadastrar 2 meses depois). Aceitar — gera parcelas com occurred_on passado, viram "em atraso" automaticamente. UI sem warning v1.
- **N parcelas inflar /transacoes**: probabilidade alta (10-12 parcelas/plano), impacto baixo (filtros já existem). Aceitar.
- **Mês com 30/31 dias e first_due_date=31**: `setMonth` em JS pode dar resultado inesperado. Mitigação: usar UTC date math + clamp ao último dia se overflow.
- **Cancelar plano deixa transactions órfãs**: FK on delete set null preserva. UI mostra que "parcelas geradas viram lançamentos avulsos". Aceitar.

## Hipóteses a validar

- **"Tiago vai cadastrar parcelados regularmente"**: validar — se em 4 semanas ele não cadastrou nenhum, repensar valor da feature.
- **"Card simples com 'parcela X/N' é suficiente"**: pode ser que queira ver "próxima vence em 3 dias". Validar.

## Open questions

- **Botão "Marcar próxima como paga"** inline no card do plano, ou só via /transacoes?
  → Resposta proposta: **não** v1. /transacoes já tem mark-paid inline; duplicar é ruído. Confirmar.
- **Ordem da listagem** de parcelados em andamento: por first_due_date asc (mais antigo primeiro) ou parcelas pendentes desc?
  → Resposta proposta: **first_due_date asc** (cronológico). Confirmar.
- **Mostrar valor total na card ou só valor da parcela?**
  → Resposta proposta: **valor da parcela em destaque** + "{N}× R$ X = R$ Total" em sublabel. Confirmar.
- **Categoria obrigatória ou opcional na criação?**
  → Resposta proposta: **obrigatória** (igual recurring; pra agregação por categoria fazer sentido). Confirmar.
