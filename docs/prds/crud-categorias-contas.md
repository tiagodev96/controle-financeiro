# CRUD de categorias e contas

## Problema

Categorias e contas hoje vêm exclusivamente do `supabase/seed.sql`. Qualquer household real precisa **rodar SQL manual** pra criar categoria nova (ex: Streaming) ou conta nova (ex: cartão Nubank que abriu mês passado). Isso quebra a premissa básica do app — controle pessoal — porque:

1. **Não dá pra usar fora do ambiente do Tiago.** Laine não tem acesso ao Supabase dashboard, então adicionar categoria depende dele.
2. **As rotas `/categorias` e `/contas` aparecem no nav e retornam 404.** Cada clique acidental quebra a confiança no app.
3. **Vai virar atrito alto na primeira semana de uso real.** "Recebi um novo tipo de freela mas não tem categoria pra isso" → bloqueio.

Sem CRUD, o produto não sai de dev.

## Usuário afetado

- **Tiago no primeiro deploy de produção** (peso alto, único acesso): configura as categorias e contas iniciais do household antes de avisar a Laine.
- **Tiago/Laine durante uso semanal** (peso médio): cria categoria nova quando aparece tipo de despesa não previsto (Streaming, Pet, Internet) ou conta nova (cartão de crédito, conta digital aberta).
- **Tiago arquivando categoria/conta obsoleta** (peso baixo, ocasional): conta velha que zerou, categoria que não usa mais.

## Métrica de sucesso

**Nenhum SQL manual roda em prod pra criar categoria/conta após primeiro mês de uso.** Medido por log de queries no Supabase dashboard — se Tiago precisa abrir SQL Editor depois de mergeado, a feature falhou.

Proxy: Tiago consegue configurar o household inteiro de produção pela UI em ≤ 5 min na primeira sessão, sem documentação aberta.

## Escopo

### Dentro

**Categorias** (`/categorias`):
- Listing com 2 seções: "Despesa" e "Entrada", agrupadas por `kind`. Ordem dentro de cada seção: por `sort_order` asc (= ordem de criação).
- Subseção "Arquivadas" colapsada por default, mostrando categorias com `is_archived=true`.
- Botão "Nova categoria" no topo — abre Dialog com form: `name` (text, required, max 50 chars), `kind` (toggle Despesa/Entrada, default Despesa).
- Cada row da lista exibe ícone (do `iconForCategory(name)`), nome, e menu de ações (•••): "Renomear" (edit inline), "Arquivar" (move pra seção arquivadas), "Desarquivar" (em arquivadas).
- **Renomear inline**: click no nome troca pra input controlled. Enter ou blur salva; Esc cancela.
- **Não muda `kind`** após criação — alterar implica re-validar todas as transactions vinculadas. Sai do escopo.
- **Não há hard delete.** Arquivar é a única forma de "remover".

**Contas** (`/contas`):
- Listing único (não há "kind" — só `currency`). Mesma estrutura: ativas no topo + arquivadas colapsadas embaixo.
- Cada row: name + CCY badge (EUR brass / BRL sage) + balance_cents formatado + menu •••.
- Botão "Nova conta" — Dialog com: `name` (text, required), `currency` (toggle EUR/BRL, default EUR), `initial_balance_cents` (MoneyInput, default 0).
- Renomear inline.
- Arquivar/desarquivar. Conta com `balance_cents != 0` arquivada mostra hint "arquivada com saldo R$ X,YZ" — não bloqueia.
- **Não muda `currency`** (idem categorias). **`balance_cents` é read-only** — saldo atualiza via transactions futuras, não há "ajustar saldo manualmente" no v1.

**Server Actions**:
- `createCategory(name, kind)` — valida, insere, retorna `{ok:true|false}`.
- `renameCategory(id, name)` — valida unicidade, update.
- `archiveCategory(id)` / `unarchiveCategory(id)` — toggle `is_archived`.
- Idem pra `createAccount(name, currency, initialBalanceCents)`, `renameAccount`, `archive`/`unarchive`.

**Validações server**:
- name não vazio, max 50 chars, trim.
- name único por household (DB constraint já existe; action devolve mensagem amigável em conflito).
- currency ∈ {EUR, BRL}, kind ∈ {expense, income}.
- initial_balance_cents inteiro ≥ 0 (não permite saldo inicial negativo no v1 — overdraft é PRD própria).

### Fora (explicitamente)

- **Reordenar via drag-and-drop**. Ordem default = ordem de criação. PRD futura quando o usuário pedir.
- **Categoria com ícone/cor customizada pela UI**. Ícone vem do `iconForCategory(name)` (regex no nome). `icon` e `color_hint` no schema ficam null por ora.
- **Categoria `kind='transfer'`**. Schema suporta mas não há fluxo de transferência. PRD própria.
- **Hard delete**. Arquivar resolve. Se vier dor real, considerar.
- **Merge de categorias** (fundir duas em uma, re-vinculando transactions). PRD futura se aparecer dor.
- **Ajuste manual de saldo da conta**. Saldo é derivado de transactions. Se ficar fora do real, é PRD própria de "reconciliar".
- **Bulk actions** (arquivar múltiplas, exportar lista, etc).
- **História de mudanças** (quem renomeou quando). Sem audit log no v1.
- **`/categorias` e `/contas` sem auth gate** — proxy já cobre, sem mudança.
- **Trigger pra criar transaction de "ajuste de saldo inicial"** quando conta é criada com `initial_balance_cents > 0`. Por ora, gravo `balance_cents` direto na conta. Quando PRD de saldo derivado-de-transactions chegar, isso vira retroativo.

## Abordagem proposta

Duas pages server-component simétricas: `/categorias` e `/contas`, cada uma lendo do supabase via helper `listCategoriesForHousehold(supabase, householdId, { includeArchived: true })` e `listAccountsForHousehold(supabase, householdId, { includeArchived: true })`. Listing renderiza com client component `<CategoryListItem>` / `<AccountListItem>` que tem inline rename + menu de ações.

Server Actions agrupadas em `src/server/actions/categories/` (create, rename, archive, unarchive) e `src/server/actions/accounts/` (idem). Cada action chama um core testável `<Action>Core({supabase, session}, input)`, padrão já estabelecido em `markPaidCore`.

Form de criação é shadcn `<Dialog>` (modal centralizado, com close + overlay). Não usa Sheet pra não conflitar com padrões mobile sheet futuros. Mesmo Dialog tanto em mobile quanto desktop — Dialog responsive funciona bem.

`revalidatePath('/categorias')` / `revalidatePath('/contas')` após cada mutation pra refresh da listing. `revalidatePath('/lancar')` também — categorias afetam chips do form.

## Dependências

- **Schema**: pronto. Sem migration.
- **RLS**: pronto. Policies "by household" cobrem.
- **Constraint UNIQUE(household_id, name)** em categories — já existe (foi o que bloqueou o seed v1 com "Outros" duplicado). Replicar no client com mensagem de erro amigável.
- **Constraint UNIQUE(household_id, name)** em accounts — verificar se existe; se não, **adicionar migration**. Bloqueante: confirmar.

## Riscos

- **Renomeação inline perde dado se usuário sai da página com input ativo**: probabilidade média, impacto baixo (perde só o rename pendente, não a categoria). Mitigação: salvar em blur, mostrar pequeno indicador "salvando" durante a action.
- **Arquivar categoria que tem transactions ativas vinculadas**: probabilidade alta, impacto baixo. Transaction continua válida (referência à categoria) — só some dos chips/filtros. **Não bloquear o arquivamento** por ter transactions vinculadas; aceitar comportamento.
- **Arquivar conta com saldo != 0**: probabilidade alta no longo prazo, impacto baixo. Conta arquivada continua exibindo o saldo histórico. Não soma no balance do dashboard (já filtra is_archived=false). Mostrar hint visual. **Não bloquear**.
- **`initial_balance_cents` na criação fica desconectado de transactions**: probabilidade alta, impacto médio. Hoje o `balance_cents` é a fonte de verdade do saldo, mas quando PRD futura "saldo derivado de transactions" chegar, esse valor inicial precisa virar uma transaction-fantasma de "saldo inicial". Aceitar como débito conhecido. Documentar em comment no schema/seed.
- **Race em rename simultâneo** (improvável com 2 usuários, mas existe): probabilidade muito baixa, impacto baixo. Ignorar.
- **Race em criar duas categorias com mesmo nome simultaneamente**: a constraint do DB pega — action retorna erro. Validação client é pra UX, não correção.

## Hipóteses a validar

- **"Renomeação inline é mais conveniente que modal de edit"**. Premissa: usuário renomeia raramente (typo) e modal seria over-kill. Se em uso real o casal ficar perdido procurando "como editar", trocar pra item no menu •••.
- **"`initial_balance_cents` na conta nova é fluxo aceitável"**: o usuário entende que isso é "quanto a conta tinha no momento que ele cadastrou aqui". Validar em uso. Se gera dúvida, repensar (talvez sempre 0 e exigir lançamento manual da abertura).
- **"Sem reordenação manual, ordem alfabética/criação é suficiente"**. Validar — se Tiago quer "Mercado" sempre antes de "Restaurante" mesmo criando depois, drag-and-drop sobe na prioridade.

## Open questions

- **Form de criação: Dialog centralizado ou Sheet bottom?** → Resposta proposta: Dialog. Funciona bem em mobile e desktop, não conflita com padrões de sheet bottom de mobile usados em outros lugares (não temos hoje, mas futuro). Confirmar.
- **`/categorias` em mobile mostra ambos os kinds na mesma página, ou tabs separadas (Despesa/Entrada)?** → Resposta proposta: ambos na mesma página com headers (Despesa, Entrada) — vai dar lista curta no início (6 expense + 3 income), sem fragmentar. Quando passar de 20+, repensar. Confirmar.
- **Pode arquivar a única categoria de um kind, deixando household sem categoria daquele tipo?** → Resposta proposta: sim, sem bloqueio. /lancar mostra empty state com CTA pra criar nova. Mantém consistência com household zerado (sem categorias) que já tem empty state. Confirmar.
- **Pode arquivar a única conta?** → Resposta proposta: sim, sem bloqueio. Mesma lógica. /lancar mostra empty state. Confirmar.
- **Renomear conta — re-renderiza chip de CCY na listagem de transactions?** → Mudança de name não afeta chip (chip é currency, não name). Apenas o texto "name (currency)" no select da /lancar muda. Sem complicação.
- **Confirmação modal antes de arquivar?** → Resposta proposta: não, sem modal. Ação é reversível (desarquivar) — fricção não vale a pena. Confirmar.
- **Migration UNIQUE(household_id, name) em accounts existe?** → Verificar `docs/schema.sql`. Se não existir, adicionar migration. Confirmar entendimento antes de codar.
