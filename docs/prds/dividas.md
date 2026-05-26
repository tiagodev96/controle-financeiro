# Dívidas (debts)

## Problema

owner hoje tem dívidas reais (empréstimo do Jefferson, parcelas do notebook, fatura do cartão) sem onde rastrear no app — fica de boca/planilha/lembrança. Três efeitos:

1. **Sobra prevista distorcida**: pagamentos parciais que ele faz toda semana viram transactions soltas, sem agregação. Não dá pra ver "quanto ainda falta do empréstimo".
2. **Sem priorização**: três dívidas com prioridades diferentes (juros altos vs amigo), e o app não ajuda a decidir qual quitar primeiro.
3. **Rota /dividas no nav que retorna 404**: lembrete diário de feature prometida não entregue.

## Usuário afetado

- **owner cadastrando dívida nova** (peso baixo, frequência mensal): "fiz acordo com Jefferson, devo R$ 3.000, prioridade alta".
- **owner/co-membro registrando pagamento parcial** (peso médio, semanal): "paguei R$ 300 do Jefferson hoje via PIX".
- **owner marcando como quitada** (peso baixo, eventual): após o último pagamento, ou quando perdoou.
- **owner/co-membro visualizando o progresso** (peso médio, mensal): "quanto falta de cada uma?"

Não é pra: compras parceladas com datas fixas (installment_plans tem PRD separada), simulação de juros, dívidas de terceiros (você emprestar pra alguém).

## Métrica de sucesso

**Toda dívida atual do owner está cadastrada no app dentro de 1 semana após deploy** + **pagamentos via app refletem em `debts.remaining_amount_cents` em tempo real (via trigger)**, medido por sample manual de 3 dívidas reais. Se o casal continuar usando planilha pra rastrear "quanto falta", a feature falhou em substituir o método atual.

Proxy direto: 3 dívidas reais cadastradas + 5 pagamentos registrados na primeira semana.

## Escopo

### Dentro

**CRUD de dívidas**:
- `/dividas` lista debts em duas seções: **Abertas** (status=open) e **Fechadas** (status=closed). Empty state no household zerado.
- Dialog "Nova dívida": `title`, `valor original` (MoneyInput), `currency` (toggle EUR/BRL), `priority` (toggle alta/média/baixa), `notes` opcional. `target_installments` e `target_quit_date` ficam NULL no v1.
- Card de cada dívida exibe:
  - title + priority badge (alta=clay, média=amber, baixa=brand-quiet)
  - `Num` remaining destacado + `Num` original em fg-muted
  - Progress bar mostrando % pago
  - Botão "Registrar pagamento" (só em abertas)
  - Menu ••• com: Editar, Marcar como quitada, Reabrir (em fechadas), Cancelar
- Editar (Dialog mesma estrutura do create, pré-preenchido): só title/priority/notes editáveis. `original_amount_cents` e `currency` **não** editáveis (mudar valor original quebraria coerência com transactions já ligadas).
- Cancelar (hard delete): transactions ligadas perdem `source_debt_id` (FK `on delete set null`).

**Registrar pagamento**:
- Dialog acionado pelo botão "Registrar pagamento" do card:
  - `valor` (MoneyInput, default = remaining, max = remaining)
  - `conta` (select)
  - `data` (default hoje)
  - `descrição` (default "Pagamento — {title}", editável)
- Submit cria transaction com:
  - `source_debt_id = debt.id`
  - `direction = 'expense'`
  - `status = 'paid'`, `paid_on = data`
  - `account_id`, `currency = account.currency`, `amount_cents`, `description`
  - `category_id = null` (dívida não vem com categoria por default)
- Trigger `recalc_debt_remaining` no DB cuida do resto: atualiza `remaining_amount_cents`, vira `status='closed'` + `closed_at=now()` quando remaining ≤ 0.
- Toast: "Pagamento registrado." OU "Dívida fechada. {totalQuitado} quitada." se acabou de fechar.

**Fechar manualmente / Reabrir**:
- Item de menu "Marcar como quitada": seta `status='closed' + closed_at=now()`. Não cria transaction. Não zera remaining (mostra hint "fechada com {remaining} em aberto" na seção Fechadas).
- Item "Reabrir": seta `status='open' + closed_at=null`.

### Fora (explicitamente)

- **installment_plans** (parcelamento com datas fixas) — PRD separada.
- **Vincular transaction solta a debt depois** (editar `source_debt_id` no /lancar ou /transacoes). PRD futura.
- **Suggestion no dashboard** ("sua sobra prevista é €X, quitar Y% da dívida prioritária"). Heurística não trivial, PRD própria.
- **Juros / capitalização** — schema não modela.
- **Editar `original_amount_cents`** — semantics quebra. Cancela e recria.
- **target_installments / target_quit_date** — schema permite mas v1 não coleta. Quando user pedir, adicionar campos no Dialog.
- **Histórico de pagamentos dentro do card** — usuário vai em /transacoes filtra por descrição. v1 sem timeline embedded.
- **Currency conversion** entre dívida e conta de pagamento. Aceitar dívida EUR ser paga de conta BRL com valor em BRL (não converte). UI mostra warning se moedas diferentes.
- **Soft delete de dívida** — hard delete (consistente com transactions e recurring rules).
- **Confirmação modal** antes de marcar quitada/reabrir/cancelar — toast confirma.

## Abordagem proposta

Page server-component em `/dividas` faz uma query de debts ordenada por priority asc + remaining desc. Componentes client espelham o pattern recurring/categorias: `<CreateDebtDialog>`, `<DebtListItem>` (com inline rename via menu, igual recurring), `<RegisterPaymentDialog>` (acionado pelo botão Registrar pagamento do card).

Cores em `src/server/actions/debts/`:
- `core.ts` — createDebt, updateDebt, closeDebt, reopenDebt, deleteDebt
- `register-payment-core.ts` — cria transaction com `source_debt_id` (trigger DB faz o recalc)
- `actions.ts` — wrappers

Helper `listDebtsForHousehold` em `src/lib/finance/debts.ts` retorna `{ open, closed }`.

Trigger do DB já cuida da consistência — código TS não precisa recalcular nada.

## Dependências

- **Schema**: pronto. Trigger `recalc_debt_remaining` já cobre todas as mutações de transaction.
- **RLS**: policy `debts by household` já existe.
- **Pattern de UI** (CreateDialog + ListItem + menu •••): herdado de recurring/categorias/contas.

## Riscos

- **Trigger não disparar quando transaction tem `source_debt_id`**: probabilidade muito baixa (schema testado), impacto alto se acontecer (remaining errado). Mitigação: integration test que valida o trigger explicitamente.
- **Registrar pagamento com valor > remaining**: probabilidade média (usuário errou), impacto baixo (vira saldo negativo no remaining — trigger usa `greatest(..., 0)` então fica 0). Mitigação: UI clampa `max=remaining` no input, e action valida server-side.
- **Currency da conta diferente da currency da dívida**: probabilidade média (dívida EUR paga via conta BRL), impacto médio (transaction fica BRL, dívida EUR — soma vira incoerente porque trigger soma `amount_cents` cru). Mitigação **v1**: UI bloqueia escolha de conta com currency diferente da dívida. Conversão fica como PRD futura.
- **Excluir dívida com transactions ligadas**: FK `on delete set null` mantém transactions, mas perdem rastreamento. Aceitar — usuário foi avisado pelo padrão de "cancelar regra" recorrente.
- **Reabrir dívida fechada e remaining recalcular como negativo** (porque havia sido fechada manualmente com remaining > 0 e pagamentos foram feitos depois): improvável (fechada manual não tem pagamentos extras), aceitar.

## Hipóteses a validar

- **"Sem suggestion no dashboard, /dividas é descobrível o suficiente"**: hoje só está no nav. Validar — se owner não abre /dividas em 2 semanas, o card Sugestão no dashboard sobe na prioridade.
- **"Registrar pagamento via Dialog do card é UX ok"**: alternativa seria /lancar com select de "vincular a dívida". Dialog inline reduz fricção. Validar com uso real.
- **"Priority alta/média/baixa (3 níveis) é suficiente"**: pode pedir 5 níveis se aparecer dor.

## Open questions

- **Onde fica o botão "Registrar pagamento"**? Inline no card (junto com remaining) ou só dentro do menu ••• ? → Resposta proposta: inline no card como primary CTA brass, menu ••• tem o resto. Confirmar.
- **Bloquear pagamento com currency diferente**? → Resposta proposta: sim, no v1. UI desabilita contas com currency diferente da dívida no select. Banner "Sem contas em EUR — pagamento bloqueado" se nenhuma combina. Confirmar.
- **Limit do MoneyInput de pagamento ao remaining**? → Resposta proposta: sim, o input não aceita digitar acima do remaining. Confirmar.
- **Description default do pagamento**? → Resposta proposta: "Pagamento — {title}". Editável. Confirmar.
- **Sort secundário em open: por priority asc + remaining DESC ou ASC?** → Resposta proposta: DESC (maior dívida primeiro dentro da mesma prioridade — Jefferson R$ 3k vem antes de Cartão R$ 800 se ambas são prioridade alta). Confirmar.
- **Editar muda priority?** → Resposta proposta: sim, priority é mutável (não é estrutural como amount). Confirmar.
