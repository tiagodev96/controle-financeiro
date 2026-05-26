# Lançar despesa rápida

## Problema

Despesa não lançada na hora vira despesa esquecida, e despesa esquecida quebra a previsão do mês. Apps de controle financeiro que pedem 5+ taps pra registrar um gasto fazem o usuário procrastinar (a fila do mercado é curta, o motorista do Uber chegou, etc) e abandonar o registro. Hoje o casal lança manualmente em planilha, o que só funciona quando há tempo sentado no notebook, ou seja, lança quase nunca.

## Usuário afetado

Membro autenticado de um household que acabou de fazer um gasto físico ou online, geralmente no celular, geralmente em movimento (saindo da padaria, na fila do caixa, depois de pagar conta no PIX). Peso maior: despesas pequenas e frequentes (€ 2 a € 50). Peso menor: gastos grandes únicos (esses tendem a ser planejados como recorrente/parcela). Não é pra: registrar parcelas (existe `/parcelas`), registrar recorrentes (existe `/recorrentes`), registrar pagamento de dívida (existe ação dedicada em `/dividas`).

## Métrica de sucesso

Tempo do toque inicial em "Lançar" (no bottom nav) até o toast de sucesso menor que **10 segundos** em conexão 4G normal, num lançamento típico (categoria existente, conta lembrada, valor de até 4 dígitos). Medido manualmente com cronômetro durante a primeira semana de uso real, e a partir daí proxy via timestamp no `transactions.created_at` comparado com timestamp do request inicial logado client side.

Sem proxy de "adoção" porque a métrica de uso é binária: ou usa, ou volta pra planilha. Se em 4 semanas pós-lançamento o casal estiver registrando menos de ~20 transações na semana, a feature falhou independente do que o número de lançamentos diga, e revisitamos antes de construir mais.

## Escopo

### Dentro

- Tela `/lancar` com formulário mobile first (max-w-md, padding generoso pra dedão).
- Campos: valor (autofocus, numpad nativo via `inputMode="decimal"`), descrição (text), categoria (chip selector com top 6 mais usadas do household + botão "ver todas" abrindo lista completa), conta (select lembrando a última usada via cookie), toggle "já pago" (default OFF para despesa), data (default hoje, picker mobile native).
- Validação client com Zod (mesma schema que o servidor importa, mantida em `src/lib/transactions/schema.ts`).
- Server Action `createTransaction` que: valida o input, deriva `household_id` do user autenticado, deriva `currency` da conta selecionada, faz INSERT em `transactions` com `status='pending'` por default (ou `'paid'` + `paid_on=hoje` se o toggle estiver ON), retorna sucesso ou erro.
- Após sucesso: toast "Despesa lançada. Saldo previsto: € X,YZ" (X,YZ calculado via projeção rápida) e redirect para `/`.
- Após erro: mantém o form preenchido, mostra mensagem inline acima do botão.
- Pré-condições UI: se o household ainda não tem categorias ou contas, o form mostra estado vazio com CTA "Criar categoria" / "Criar conta" antes de permitir submit.

### Fora (explicitamente)

- **Lançar entrada (income)**: tem fluxo separado em `/entrada` ou tab no próprio form. Decisão de UX pendente, mas implementação não é esta PRD.
- **Edição ou exclusão de transação** a partir deste form: vai em `/transacoes`.
- **Vincular a recorrente, parcela ou dívida**: feito pelas UIs dedicadas (`/recorrentes`, `/parcelas`, `/dividas`). Aqui é despesa solta.
- **Upload de comprovante / foto / OCR**: roadmap v2.
- **Divisão de despesa entre categorias** (50% Mercado + 50% Pet): roadmap v2.
- **Auto categorização por descrição** ("Uber" vira Transporte automaticamente): roadmap v2.
- **Conversão inline de moeda**: a moeda é a da conta selecionada, sem override.
- **Salvar como template / favorito**: roadmap v2.
- **Deduzir automaticamente do saldo da conta quando marca "já pago"**: a §5.2 do spec menciona essa pergunta opcional na ação "marcar como pago" em listas existentes, mas neste form de criação a primeira versão NÃO faz a dedução automática. A dedução fica como follow up dedicado.
- **Notificação para o outro membro do household**: roadmap v2 (push não está no MVP).

## Abordagem proposta

Page server component `src/app/(app)/lancar/page.tsx` faz duas queries com o supabase server client: lista de categorias (ordenadas por uso desc, top 6) e lista de contas ativas. Passa pra um client component `<LancarForm categories accounts lastAccountId />` que renderiza o formulário e usa `useFormState` (Next 16) ligado à Server Action `createTransaction` em `src/server/actions/transactions/create.ts`. A action valida com Zod (schema importado de `src/lib/transactions/schema.ts`, mesmo arquivo que o client usa), insere a linha, e retorna `{ ok: true, transaction }` ou `{ ok: false, error }`. Redirect e toast acontecem no client após a resposta.

O cookie `cf_last_account_id` (httpOnly false, pra ser legível no client) é setado pela própria action no sucesso, pra próxima visita já vir pré-selecionado.

## Dependências

- **Auth funcional**: hoje o `/login` é só visual (form sem handler). A Server Action precisa do `auth.uid()` resolvido. Solução pra desbloquear: implementar magic link como pré-requisito desta feature, OU criar um helper de teste E2E que faz login com password local (já tem usuário no seed) via `signInWithPassword`. Recomendação: o helper de teste, porque magic link merece sua própria PRD e move pra fora deste escopo.
- **Categorias no seed**: hoje o seed cria 0 categorias. Pra E2E funcionar e pro app não ficar com estado vazio em dev, adicionar ~6 categorias default no seed (`Mercado`, `Restaurante`, `Transporte`, `Moradia`, `Lazer`, `Outros`). Não é parte do código da feature, é só uma linha extra no seed.
- **Helper `currentHouseholdId`**: precisa ser extraído (a Server Action vai usar e qualquer outra action também). Extração faz parte da fase de refactor desta feature.

## Riscos

- **Auth não implementada bloqueia o E2E**: probabilidade alta, impacto alto. Mitigação: helper `signInAsFixtureUser` em `tests/helpers/auth.ts` que chama `supabase.auth.signInWithPassword({ email: 'owner@example.com', password: 'password-local' })` antes de cada teste E2E que precisa de sessão. Quando o magic link for implementado de verdade, o helper fica como fallback de teste.
- **Schema Zod duplicado entre client e server**: probabilidade média, impacto baixo (manutenção). Mitigação já está no plano: schema único em `src/lib/transactions/schema.ts`, importado dos dois lados.
- **Household sem categorias**: probabilidade alta no início, impacto médio (form com submit desabilitado). Mitigação: seed traz 6 categorias default + UI exibe CTA explícita pra criar mais.
- **Race condition em duplo submit (usuário tapa 2x rapidamente)**: probabilidade média, impacto baixo (duplicata). Mitigação: desabilitar botão durante `useFormStatus().pending`.
- **Cookie de "última conta usada" não funciona em modo privado / safari ITP**: probabilidade baixa, impacto baixo (cai pra primeira conta da lista). Aceitar.

## Hipóteses a validar

- "Top 6 categorias mais usadas + 'ver todas' resolve a seleção sem fricção". Se em 2 semanas a maioria dos lançamentos exigir clicar em "ver todas", o ranking não está representando o uso. Re visitar.
- "Toggle 'já pago' OFF por default está certo pra despesa". Premissa: maioria das despesas é vencimento futuro (boletos, fatura cartão). Se na prática a maioria é PIX/cartão pago na hora, inverter o default.
- "Numpad nativo (`inputMode="decimal"`) é bom o suficiente em iOS e Android". Se houver atrito (vírgula vs ponto, layout diferente entre dispositivos), considerar numpad custom.

## Open questions

- **Marcar "já pago" deve sugerir deduzir do saldo da conta?** O spec §5.2 fala disso na ação "marcar como pago" em listas. Aqui no form de criação, primeira versão NÃO oferece a sugestão (fica como follow up). Confirmar com owner antes de buildar. → **Resposta proposta neste PRD: não oferecer agora.**
- **Categoria sugerida é por household ou por usuário individual?** Se é household, todos compartilham o ranking. Se é individual, cada profile vê seu próprio top 6. Recomendação: **por household** (alinha com a regra de "fluxo conjunto" já decidida). Confirmar.
- **Moeda do lançamento**: vem estritamente da conta? Recomendação: **sim**. Conta é EUR → despesa é EUR. Sem override. Confirmar.
- **Falta de categoria deve bloquear submit ou criar "Outros" automaticamente?** Recomendação: **bloquear com CTA explícita** ("Crie ao menos uma categoria primeiro" + botão). Categoria "Outros" automática esconde o problema. Confirmar.
- **`/lancar` mostra preview de "saldo previsto após este lançamento"?** Pode ajudar a confirmar magnitude antes do submit, mas adiciona uma query e complexidade. Recomendação: **não na v1 dessa feature**, mostra no toast após sucesso. Confirmar.
