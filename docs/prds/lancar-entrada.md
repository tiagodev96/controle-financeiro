# Lançar entrada (income)

## Problema

O app hoje só registra **despesa**. Quem usa não consegue dizer "recebi o salário" ou "caiu o freela" — não tem onde. Isso quebra duas coisas:

1. **A sobra prevista do dashboard fica distorcida** — ela calcula `saldo + entradas pendentes - despesas pendentes`, mas se entradas nunca são lançadas, o valor mostrado é sempre pessimista (só saída).
2. **O app vira "controle de despesa" e não "controle financeiro"** — abandona metade da promessa do nome.

A rota `/lancar` está pronta pra fluxo de despesa. Adicionar entrada nela é o menor delta de UI possível que fecha o ciclo de "tudo que entra e sai do mês".

## Usuário afetado

Mesma persona do lançar despesa (owner + co-membro), mas com **frequência menor por usuário**: entradas acontecem 1-4x por mês cada (salário fixo, freela esporádico) vs despesas 10-30x. Cenários típicos:
- "Recebi salário hoje" (mensal recorrente — vira PRD futura de recorrente, mas v1 lança manual)
- "Caiu freela" (esporádico)
- Não é pra: transferência entre contas (vira PRD própria), conversão de moeda, recebimento parcelado.

## Métrica de sucesso

**Sobra prevista do dashboard reflete a realidade do mês** — medido por: ao final de 2 meses pós-lançamento, a diferença entre `sobra_prevista_no_dia_1` e `saldo_real_no_último_dia` da moeda primária está dentro de ±15%. Se a discrepância ficar acima de 30% (entradas não lançadas continuam dominando o erro), a feature falhou em ser usada e a hipótese cai.

Proxy direto na primeira semana: cada usuário lança pelo menos 1 entrada por semana sem suporte.

## Escopo

### Dentro

- **Toggle Despesa/Entrada** no topo do `/lancar` — segmented control com 2 botões, ícone `ArrowDown` pra despesa e `ArrowUp` pra entrada. Default `expense`.
- **Categorias filtradas por `kind`** — query da page passa o `kind` selecionado. Quando toggle muda, navega via searchParam (`?direction=income`) e a server component re-fetcha o set certo. Categoria selecionada é resetada na troca.
- **Seed de 3 categorias income default**: `Salário`, `Freela`, `Outros`. Adicionadas ao `supabase/seed.sql`.
- **Empty state por direction** — se household não tem categoria do tipo escolhido, mostra a empty state existente apontando pra `/categorias`. Pra income, ao menos o seed já cobre.
- **Action `createTransaction` aceita `direction`** — campo novo no schema do input, default `'expense'` pra compatibilidade. Validado via Zod enum.
- **"Já pago" default ON quando `direction='income'`** — entrada é geralmente dinheiro recebido (não vence). Usuário pode desligar pra registrar previsão.
- **Copy adapta ao direction**:
  - Eyebrow da page: "Nova despesa" / "Nova entrada"
  - h1: "Lançar despesa" / "Lançar entrada"
  - Botão CTA: "Lançar despesa · −€X,YZ" / "Lançar entrada · +€X,YZ"
- **Cor do Num no CTA**:
  - Despesa: clay (`money-negative`) com sinal `−`
  - Entrada: sage (`money-positive`) com sinal `+`
- **TxnRow / status pill** já tratam direction (income vira sage com `+`) — sem mudança necessária.
- **Dashboard sobra prevista e stat trio** já agregam income vs expense — query existente em `calculateMonthStats` cobre. Sem mudança.

### Fora (explicitamente)

- **Rota `/entrada` separada** — toggle no `/lancar` é menos código, mesmo deep-link via `?direction=income` se quisermos.
- **Recurring income** (salário mensal automático) — vira PRD própria de "regras recorrentes" que vai gerar transactions pending no início do mês.
- **Transferência entre contas** (income+expense lados opostos) — PRD própria. Nem RLS nem schema atual modelam isso.
- **Conversão de moeda no lançamento** — mantém moeda da conta selecionada.
- **Pix recebido como tipo distinto** — é só income comum, sem subtipo.
- **Split entre múltiplas contas** — v1 é uma conta só.
- **Categoria do tipo `transfer`** — schema suporta mas não é v1.
- **Atualização automática do saldo da conta** quando income é marcada como recebida — mesma justificativa do mark-paid: PRD futura.

## Abordagem proposta

O `/lancar` server page lê `searchParams.direction` (default `expense`), passa pro `<LancarForm>` junto com a lista de categorias filtrada por `kind=direction`. O LancarForm passa a aceitar `direction` como prop controlled — o toggle (client) navega com `router.push('/lancar?direction=...')`, server re-fetcha categorias, form remonta com nova prop e reseta `categoryId`. Action createTransaction adiciona `direction` ao schema Zod. Default `paid=true` quando `direction='income'`. Copy + cor do CTA via condicional simples no JSX.

Seed novo de income (Salário, Freela, Outros) com IDs fixos e `kind='income'`. Aplica via `supabase db reset` em dev. Em prod: PRD `provisioning.md` já cobre via SQL Editor.

## Dependências

- **Schema** já suporta tudo (`transactions.direction` enum + `categories.kind` enum). Sem migration.
- **`listTopCategoriesForHousehold`** atual filtra implicitamente expense via ranking de uso. Precisa aceitar `kind` opcional e filtrar por `categories.kind=kind`.
- **Seed local** — `supabase db reset` aplica.
- **Seed de produção** — adicionar Salário/Freela/Outros via SQL Editor no primeiro deploy (atualizar `docs/operations/provisioning.md` com snippet).

## Riscos

- **Toggle inverte fluxo do usuário sem aviso**: probabilidade baixa, impacto baixo. Usuário pode trocar acidentalmente. Mitigação: visual claro do segmented + reset de categoria força nova escolha consciente.
- **Income com `paid=false`** (registrar "vou receber X"): probabilidade baixa, impacto baixo. Schema permite, fluxo aceita, mas o dashboard de sobra prevista vai contar essa entrada antecipadamente. Aceitar — é informação útil quando o usuário sabe que dinheiro vai cair.
- **Seed novo conflitar com categorias customizadas em prod** (futuro): probabilidade média no longo prazo, impacto baixo. Mitigação: IDs fixos com `on conflict do nothing` no SQL — se já existir Salário do household, não duplica.
- **`listTopCategoriesForHousehold` quebrar se mudar assinatura**: probabilidade alta (vou mudar pra aceitar `kind`), impacto alto se quebrar. Mitigação: teste de integração novo + manter compat (kind opcional, default expense).

## Hipóteses a validar

- **"Frequência de income é baixa o suficiente que o usuário lembra de lançar"** — sem recurring automation, depende do usuário. Validar em 4 semanas: se salário (mensal certo) está caindo nos lançamentos. Se 2 meses seguidos sem lançar salário: priorizar PRD de recorrente.
- **"Toggle Despesa/Entrada é descobrível"** — não é a primeira coisa que o usuário vê (chip de Mercado/Restaurante domina visualmente). Validar com co-membro sem tutorial.

## Open questions

- **Default direction quando entra em /lancar sem param**: → Resposta proposta: `expense` (continua o fluxo mais frequente). Confirmar.
- **Bottom nav "Lançar" leva pra `/lancar` (despesa) ou pra last-used direction?** → Resposta proposta: sempre `/lancar` (sem param, default expense). Lembrar last-used adiciona estado e o ganho é marginal. Confirmar.
- **Income tem ranking de top categorias separado do expense?** → Resposta proposta: sim. `listTopCategoriesForHousehold(supabase, householdId, limit, { kind })` — passa kind, ranking só conta transactions daquele kind. Confirmar.
- **Toast pós-sucesso muda copy?** → Resposta proposta: "Entrada lançada." vs "Despesa lançada.". Confirmar.
