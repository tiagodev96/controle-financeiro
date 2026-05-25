# Transações: listing com filtros + marcar como pago

## Problema

O ciclo do app está aberto: você consegue **lançar** uma despesa (vira `pending`) e ver no dashboard que ela está sobre o saldo previsto, mas **não consegue dizer ao app que ela foi paga**. Sem isso:
- Pendentes acumulam pra sempre. Sobra prevista nunca converge pro real.
- O usuário precisa abrir o SQL/dashboard do Supabase pra mudar `status` manualmente — quebra a premissa de uso diário pelo celular.
- Não há onde ver "o que ainda tenho pra pagar este mês" sem agregar mentalmente o que o dashboard mostra de pendente.

A rota `/transacoes` está nos dois navs (bottom mobile + sidebar desktop), mas hoje retorna 404. Quando o usuário clica, a expectativa quebra duas vezes: link errado e fluxo incompleto.

## Usuário afetado

Tiago e Laine ao **fechar o ciclo do mês** — geralmente no fim do mês, sentados, revisando o que pagou e o que ficou. Peso menor: durante o mês quando lembram "ah, paguei o boleto X hoje". Ações típicas:
- "Paguei o boleto da luz hoje" → abre /transacoes → acha (filtro: pendente) → marca como pago
- "Quanto tem pendente este mês?" → /transacoes com filtro status=pendente, vê total
- "Quanto gastei na conta Itaú?" → /transacoes com filtro conta=Itaú

Não é pra: análise histórica de anos passados, exportação de extrato, conciliação bancária. Tudo isso vem em PRDs separadas se precisar.

## Métrica de sucesso

**Cada despesa pendente lançada vira pago em ≤ 7 dias da data de vencimento**, medido por: `paid_on - occurred_on` (mediana, em transações com `status='paid'`). Se a mediana ultrapassa 7 dias por 2 semanas seguidas, sinal que o fluxo de marcar como pago está com atrito demais — investigar.

Proxy direto (primeira semana, antes de ter dados): Tiago e Laine usam a feature pelo menos 3x cada na primeira semana sem pedir ajuda. Mediano caso afirmativo, alto se ambos.

## Escopo

### Dentro

- **Rota `/transacoes`** — server component que renderiza listing autenticado (proxy já cobre auth).
- **Listing** ordenado por `occurred_on desc`, agrupado visualmente por dia (Hoje, Ontem, dd/mm), pattern já usado no dashboard. Limit 100 transações.
- **Filtros via searchParams** (`?status=X&conta=Y&mes=2026-05`):
  - `status`: `todos` (default) | `pendente` | `pago`
  - `conta`: `todas` (default) | `<account-id>`
  - `mes`: `<YYYY-MM>` — default mês corrente. Inclui transações com `occurred_on` dentro do mês.
- **Filtros UI**: 3 chips/selects no topo. Cada filtro re-navega com novo searchParam (deep-linkable). Sem JS heavy de client state — Server Component lê params e refetcha.
- **Stat header** no topo da lista (acima dos filtros): contagem + soma do que **passou pelo filtro corrente**. Ex: "8 transações · €234,50".
- **Ação "marcar como pago"** em transactions com `status='pending'`: botão inline (form com Server Action), sem modal. Confirma pela própria ação otimista. Se erro, mostra inline.
- **Server Action `marcarTransacaoComoPago(txnId)`** em `src/server/actions/transactions/mark-paid.ts`:
  - Valida `txnId` (uuid Zod)
  - Lê a transaction com o supabase client autenticado (RLS garante household match)
  - Se não achar OU status já paid OU outro household: retorna erro genérico
  - Update: `status='paid'`, `paid_on=hoje` (servidor)
  - Retorna `{ ok: true }` ou `{ ok: false, error }`
- **Refactor de leitura** em `src/lib/finance/transactions.ts` (extraído): `listTransactionsForHousehold(supabase, { householdId, status?, accountId?, monthIso? }): TxnRow[]`. Centraliza pra reutilizar em testes de integração.
- **Empty states distintos**:
  - "Sem transações neste mês" (filtro vazio, mas household tem dados em outros meses)
  - "Sem transações ainda" (household zerado) com CTA "Lançar despesa"
- **Bottom nav / sidebar continuam apontando pra `/transacoes`** — agora rota responde 200.

### Fora (explicitamente)

- **Edição** de transação (mudar valor/categoria/descrição). Quando marcar pago errado: precisa "des-marcar" → PRD futura "editar/cancelar transação".
- **Exclusão** de transação. PRD futura.
- **Marcar como pago no dashboard direto** (a partir das transações recentes que aparecem no card). Por ora, marcar pago é só em `/transacoes`. Avaliar depois — se uso real mostrar atrito, copiar o botão pro dashboard.
- **Atualização automática do balance da conta** quando marca pago. PRD futura "marcar pago + saldo da conta". Por enquanto, marcar pago só muda status/paid_on; o balance manual continua sendo a fonte de verdade.
- **Filtros complexos**: range de valor, multi-conta, range de data customizado, search por descrição. v1 single-select por dimensão.
- **Paginação / infinite scroll**. Limit 100 por ora. Quando algum household passar de ~80, PRD pra paginar.
- **Lançar entrada** continua com PRD própria — esta PRD só faz listing + mark-paid, não cria nada.
- **Export CSV / impressão**. Resumo do mês é PRD própria (export pra WhatsApp).
- **Undo** após marcar como pago. Aceita: se errar, espera PRD de edição. Aceitável dado que mark-paid é decisão consciente do usuário (não é ação acidental).

## Abordagem proposta

Server Component em `/transacoes/page.tsx` lê `searchParams` (status/conta/mes), busca via `listTransactionsForHousehold` extraído pra `src/lib/finance/transactions.ts`. Componentes de filtro (`<TransactionFilters>`) são client mas só pra hooks do `useRouter`/`useSearchParams` — eles disparam navegação por `router.push(...)` quando muda. Cada `TxnRow` recebe a transação; quando `status === 'pending'`, renderiza um form inline com Server Action `marcarTransacaoComoPago`. Sem state JS pro mark-paid — Server Action retorna, page revalida, lista re-renderiza.

Para o stat header (contagem + soma do filtro corrente): calculado server-side junto com a lista, sem query extra.

## Dependências

- **Schema atual já suporta** — `transactions.status`, `paid_on`, check de coerência. Não precisa migration.
- **RLS já cobre** — policy `transactions by household` já restringe leitura/escrita ao household corrente.
- **Componentes existentes** (TxnRow, StatusPill, AppTopBar, CCY, Num) já no DS. Apenas adiciona o botão inline de mark-paid dentro do TxnRow ou ao redor.
- **Nenhuma dep externa nova**.

## Riscos

- **Marcar pago sem querer**: probabilidade média (botão visível em cada linha), impacto baixo (a transação fica registrada, só muda status). Mitigação: sem undo no v1; aceitar como custo da fricção zero. Se aparecer em uso real, considerar confirmação inline antes de commitar.
- **Filtro vira deep-link compartilhado por engano** (Tiago manda link pra Laine): probabilidade baixa, impacto nulo (a sessão do destinatário gateia auth + RLS gateia visibilidade). Aceitar.
- **Limit 100 esconde transações antigas**: probabilidade alta no longo prazo (qualquer household passa de 100 em 4-5 meses). Mitigação aceita: paginar quando virar problema. Adicionar caption "mostrando 100 mais recentes" quando bater o limit pra dar feedback honesto.
- **Server Action timing**: marcar pago é fast (single update). Sem rate-limit explícito; se o usuário spammar 50 marks em sequência, RLS + database lock cuidam. Aceitar.
- **`paid_on=hoje` no servidor**: assume timezone UTC do server. Se o usuário está em horário diferente, `paid_on` pode ficar 1 dia à frente ou atrás. Probabilidade média, impacto baixo. Mitigação: usar a date local do servidor (server roda no Vercel — UTC), aceitar pequeno deslocamento. Quando virar problema visível, passa `paid_on` opcional do client com Intl timezone local do browser.

## Hipóteses a validar

- **"Confirmação inline (sem modal) é OK pra marcar pago"**. Premissa: ação é low-stakes, modal seria fricção. Validar: nas 2 primeiras semanas, observar se Tiago/Laine reclamam de marca-erradas. Se 2+ erros em 14 dias, adicionar confirmação.
- **"Filtros via searchParams (sem persistir preferência) bastam"**. Cada navegação volta pro default (mês corrente, status todos). Se o casal sempre filtra por status=pendente, vale persistir a última escolha em cookie. Validar com uso real.
- **"Sem botão de mark-paid no dashboard é aceitável"** — usuário sempre navega pra /transacoes pra marcar. Se em uso real ficar claro que querem marcar sem sair do dashboard, copiar o botão pra lá.

## Open questions

- **Filtro de mês: chip "Maio" / "Junho" ou dropdown / picker de mês completo?** → Resposta proposta: dropdown simples com últimos 6 meses + opção "todos". Mês corrente é default. Picker custom só se virar atrito. Confirmar.
- **Stat header soma todos os valores ou só despesas (ignora entradas se filtro=todos)?** → Resposta proposta: separar — "8 transações · -€234,50 despesa · +€2.000 entrada". Se na prática só despesas estão sendo lançadas hoje, exibir só o relevante (income=0 some). Confirmar.
- **Empty state diferenciado por filtro vs household zerado?** → Resposta proposta: sim. Dois estados claros. Confirmar.
- **Onde fica o botão "marcar como pago" no TxnRow?** → Opções: (a) ícone Check à direita do valor, click direto marca; (b) botão "Marcar pago" texto inline; (c) hover/long-press abre menu de ações. Resposta proposta: (a) ícone Check inline + label aria, click direto sem modal. Toast sonner pós-marca com texto "Marcada como pago · Desfazer?" (o desfazer fica como NÃO escopo v1 conforme decidido, mas o toast confirma a ação). Confirmar.
- **Se a transação foi inserida com `paid_on` já preenchido (ex: marcou "já pago" no lançamento), ela aparece como pago direto?** → Sim — quem cuida disso é o schema (já garante coerência). Confirmar entendimento.
- **Quando marca pago, atualizar saldo da conta?** → Resposta proposta: NÃO no v1 (mantém escopo enxuto, marcar pago é só mudança de status). Saldo é decisão própria (PRD futura). Confirmar.
