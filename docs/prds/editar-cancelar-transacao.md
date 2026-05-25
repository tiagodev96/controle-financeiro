# Editar e cancelar transação

## Problema

Depois que uma transação é lançada, ela está congelada — não há como corrigir nem apagar pela UI. Os erros mais frequentes que isso bloqueia:

- Typo no valor (lancei "€12,50" mas era "€15,00")
- Categoria errada (Mercado em vez de Restaurante)
- Conta errada (Itaú em vez de Revolut)
- "Já pago" marcado errado, ou data errada
- Duplicata (cliquei "Lançar" duas vezes, ou Tiago e Laine lançaram a mesma despesa)

Sem editar/cancelar, a única saída é o SQL editor do Supabase — mesmo problema que travou o CRUD de categorias. Quebra a premissa de uso fora de dev. Com a feature de marcar como pago tendo aterrissado sem undo, esse buraco virou crítico: marca pago errado e está preso.

## Usuário afetado

- **Tiago e Laine corrigindo logo após lançar** (peso alto, frequência semanal): typo de valor, categoria errada. Comportamento: lança, vê na lista, percebe erro, edita.
- **Tiago limpando duplicatas** (peso médio, ocasional): aparece linha duplicada em /transacoes, cancela uma.
- **Tiago/Laine desfazendo "marcar como pago" acidental** (peso médio, ocasional): clicou em check sem querer, edita → desmarca pago, ou cancela e relança.

Não é pra: edição em massa, re-categorização global (PRDs futuras se aparecer dor).

## Métrica de sucesso

**Zero queries de `UPDATE transactions` ou `DELETE FROM transactions` no SQL Editor do Supabase em produção após primeiro mês de uso.** Mesmo proxy que o CRUD usa — se Tiago precisar abrir SQL, a feature falhou.

Proxy positivo: na primeira semana, pelo menos 1 edição e 1 cancelamento feitos pela UI sem dúvida operacional.

## Escopo

### Dentro

**Botão de menu por TxnRow**:
- Cada `TxnRow` em `/transacoes` ganha menu •••  (mesmo pattern de CategoryListItem/AccountListItem).
- Itens: "Editar", "Cancelar lançamento". Em pending, "Marcar como pago" continua no botão Check inline já existente (não move pro menu).
- Em paid, o menu também tem "Desmarcar como pago" (opcional — se for trivial). **Decisão: por ora, desmarcar = editar e tirar paid no form**. Sem item dedicado no menu.

**Editar (`<EditTransactionDialog>`)**:
- Dialog com form pré-preenchido pelo TxnRow clicado.
- Campos editáveis: `valor`, `descrição`, `categoria` (chips filtradas por direction da transação), `conta`, `data`, `paid` toggle (com transição automática de `paid_on`).
- Campos **não** editáveis: `direction` (mudar income↔expense é cancela-e-relança), `currency` (vem da conta — se mudar conta, currency segue junto).
- Submit chama `updateTransactionAction(id, patch)`. Sucesso → fecha dialog + toast "Lançamento atualizado." + revalidate. Erro → inline no form.

**Cancelar (`deleteTransactionAction`)**:
- Item "Cancelar lançamento" do menu → hard delete imediato (sem modal).
- Toast "Lançamento removido." (consistente com outros toasts pós-ação).
- Sem undo no v1 — consistente com archive de categoria/conta e mark-paid.

**Server Actions**:
- `updateTransactionAction(id, patch)` — patch parcial. Schema Zod aceita campos opcionais (`amountCents?`, `description?`, `categoryId?`, `accountId?`, `paid?`, `date?`). Internamente valida que `categoryId` (se mudou) pertence ao household; idem `accountId`; deriva `currency` de account; deriva `status`/`paid_on` de `paid`+`date`. RLS já gateia.
- `deleteTransactionAction(id)` — hard delete. Lê pra validar household match antes (paranoia + erro amigável vs erro genérico de RLS).

**Cores testáveis**:
- `updateTransactionCore({supabase, session}, {id, patch})` em `src/server/actions/transactions/update-core.ts`
- `deleteTransactionCore({supabase, session}, {id})` em `src/server/actions/transactions/delete-core.ts`

**Cobertura**:
- Onde TxnRow aparece com ação: `/transacoes` (sim, ganha menu); dashboard `/` (não no v1 — manter dashboard com info-display only).

### Fora (explicitamente)

- **Audit log** (quem editou quando). Schema não tem coluna; sem demanda real.
- **Undo após delete**. Toast confirma. Se aparecer dor, considerar.
- **Editar `direction`** (income↔expense). Implica re-validar categoria/conta + semantics confusa. Recomendação: cancela e relança.
- **Editar `currency`** diretamente. Currency é derivada de account. Mudar account muda currency automatic.
- **Bulk select + edit/delete múltiplos**. Sem demanda.
- **Soft delete / lixeira / "recently deleted"**. Hard delete é OK no contexto.
- **Editar no dashboard** (a partir das "Transações recentes"). v1 só em /transacoes. Se uso real reclamar, propaga.
- **Histórico de edições da mesma transação** (versionamento).
- **Validar regras temporais** (ex: bloquear editar transação de mês fechado). Sem conceito de fechamento de mês.
- **Trigger pra atualizar balance da conta** quando deleta ou edita amountCents/accountId. Mesma decisão diferida do mark-paid/create — saldo é fonte de verdade no `accounts.balance_cents`, atualização derivada vira PRD própria.

## Abordagem proposta

Reuso máximo dos primitives já existentes (`MoneyInput`, chips de categoria com `iconForCategory`, `Field` Conta/Data, toggle "Já pago"), encapsulados em um novo `<EditTransactionDialog>` client component. O dialog recebe `transaction` (full row) + `categories` + `accounts` via prop. Estado interno é o patch — começa vazio, vai sendo populado conforme campos mudam. Submit envia o patch parcial.

`updateTransactionCore` recebe `patch: Partial<UpdateInput>` e só sobrescreve no DB os campos que vieram. Se `accountId` mudou, re-deriva `currency`. Se `paid` ou `date` mudou, re-deriva `status` e `paid_on`.

`TxnRow` ganha prop `action?: ReactNode` que já existe (foi adicionada pro `MarkPaidButton`). Em `/transacoes`, o `<TxnRowMenu>` (novo) é passado como `action`, contendo o ícone de check de mark-paid (se pending) + dropdown ••• com Editar / Cancelar.

Categorias e accounts pra popular o EditDialog vêm da page server-side (uma query única `listAllCategoriesForHousehold` + `listAllAccountsForHousehold`, ambas já existem do CRUD). Passa pra page client component → passa pra cada TxnRow.

## Dependências

- **Schema**: pronto. Update arbitrário permitido por RLS.
- **Helpers existentes** que serão consumidos:
  - `listAllCategoriesForHousehold` (do CRUD recente)
  - `listAllAccountsForHousehold` (idem)
  - Primitives `MoneyInput`, `Field`, `CCY`, chips com `iconForCategory`.
- **MarkPaidButton** já existe — vai conviver no novo `<TxnRowMenu>` sem conflito.

## Riscos

- **Editar campo sensível (valor, conta) sem warning** vs editar typo: probabilidade média de erro do usuário, impacto baixo (pode editar de novo). Mitigação: sem confirmação. Aceitar — UX simples > segurança paranoica em domínio low-stakes.
- **Hard delete remove transação que pertencia a outro contexto** (ex: linkada a recurring rule futura): probabilidade baixa hoje (recurring não existe), impacto alto futuro. Mitigação: quando recurring/installment chegarem, mudar pra soft delete OU validar que `source_recurring_rule_id` é null antes de deletar. **Por ora, fica como TODO no comment**.
- **Update sem validação de coerência** (ex: `paid=false` mas `paid_on` setado): probabilidade baixa (action deriva paid_on de paid+date), impacto baixo (constraint DB pega). Aceitar — DB check é safety net.
- **Race condition** entre dois usuários editando a mesma transação: probabilidade muito baixa (2 users), impacto baixo (último write vence). Sem locking otimista. Aceitar.
- **Delete de transação já com paid_on no passado afeta retroativamente sobra prevista**: probabilidade alta (cancela despesa do mês), impacto desejado (era erro de lançamento → faz sentido sumir). Aceitar como comportamento correto.

## Hipóteses a validar

- **"Hard delete sem undo é aceitável"**: premissa baseada no fato de que mark-paid e archive também não têm undo, e ninguém reclamou. Se em 2 semanas Tiago/Laine reportarem "apaguei errado", considerar undo via toast (sonner suporta).
- **"Editar via Dialog dá densidade suficiente em mobile"**: dialog em viewport 390px com 6 campos (valor, descrição, chips, conta, data, paid) pode ficar apertado. Validar visualmente. Se ficar congestionado, considerar Sheet bottom em mobile (Dialog vira só desktop).

## Open questions

- **Item "Desmarcar como pago" no menu de transações `paid`?** → Resposta proposta: NÃO no v1. Desmarcar = abrir Editar + tirar toggle. Reduz menu noise. Confirmar.
- **Posicionamento do menu •••** na TxnRow: à direita do valor (como MarkPaidButton) ou à esquerda (próximo da categoria)? → Resposta proposta: à direita do valor, **após** o MarkPaidButton em pending (ordem: valor | check | •••), antes em paid (ordem: valor | •••). Confirmar.
- **Mark-paid e Editar podem coexistir como ações inline?** → Sim. Check inline pra ação mais comum (marcar pago), •••  pro resto (editar/cancelar). Confirmar.
- **Onde adicionar o menu além de /transacoes?** → Resposta proposta: só /transacoes no v1. Dashboard ("Transações recentes") fica info-only. Se uso reclamar, propaga. Confirmar.
- **Editar muda direction se cliente mandar direction no patch?** → Resposta proposta: action ignora direction no patch (validation Zod sem direction no schema). Confirmar.
- **Editar transação com source_recurring_rule_id ou source_debt_id não-null** (não existe ainda): bloqueia ou permite? → Resposta proposta: permite por ora — sem recurring/debts implementados, é hipotético. Adicionar TODO no comment do core. Confirmar.
