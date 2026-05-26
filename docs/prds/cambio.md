# Câmbio EUR↔BRL e saldo total convertido

## Problema

Tiago e Laine têm saldo em duas moedas (EUR via Wise/Revolut, BRL via Itaú/Nubank) e o dashboard hoje mostra os totais lado a lado sem somar. Toda vez que querem responder "quanto temos no total?", precisam fazer divisão de cabeça (BRL ÷ 6) e arredondar. Duas consequências:

1. **Resposta errada por arredondamento mental** — discutem em cima de número impreciso.
2. **O resumo mensal exportado pra Laine no WhatsApp lista contas separadas**, sem consolidado — perde a métrica mais óbvia da saúde financeira do casal.

## Usuário afetado

- **Tiago no dashboard** (peso alto, diário): quer "quanto temos no total" em uma olhada. É a primeira coisa que ele lê.
- **Tiago no /resumo** (peso médio, mensal): quer mandar pra Laine "estamos com € X total".
- **Sistema/cron** (peso baixo, diário): pré-popula o cache pra evitar fetch sob demanda na primeira visita do dia.

Não é pra: análise histórica de cotação, conversão de transactions individuais (cada transaction continua na sua currency), suporte a uma terceira moeda.

## Métrica de sucesso

**Tiago para de fazer divisão de cabeça depois de 1 semana de uso.** Medido por pergunta direta ("você ainda divide R$ por 6 antes de abrir o dashboard?"). Se ele responde "ainda faço", o card está mal posicionado ou a cotação não inspira confiança.

Proxy técnico: a primeira request do dia ao dashboard insere uma linha em `fx_rates_cache` em ≥95% dos dias úteis durante 30 dias após deploy. Se cair muito, o cron de pré-população não tá funcionando ou frankfurter está instável.

## Escopo

### Dentro

**Helper `src/lib/fx/`**:
- `getRate({ base, quote, when=today })`: retorna `{ rate, rateDate, isStale }`. Procura no cache com `rate_date >= when` (matched). Se não tem, fetch frankfurter `https://api.frankfurter.app/latest?from=EUR&to=BRL`, INSERT no cache via service role, retorna. Se fetch falha, procura a entrada mais recente em até 7 dias e retorna com `isStale=true`. Se nada, throw `FxUnavailableError`.
- `convertCents(amountCents, rate)`: puro. Multiplica e arredonda HALF_EVEN. Retorna `number` (cents).
- `getRateMap(now=today)`: chama `getRate` para a tupla canônica `(EUR→BRL)`, deriva `(BRL→EUR)` por `1/rate`. Retorna `{ EUR_BRL, BRL_EUR, rateDate, isStale }`. Usado pelo dashboard e pelo /resumo.

**Server Action `refreshFxRatesAction()`** (em `src/server/actions/fx/`):
- Wrapper invocável por cron handler que força `getRate({ base:'EUR', quote:'BRL', when: today })` ignorando cache do dia. Insere sempre. Idempotente: usa `upsert` na unique key `(rate_date, base, quote)`.
- A integração do cron (rota `/api/cron/fx`) é parte da PRD 4 (cron geral) — esta PRD entrega só o helper invocável.

**Dashboard `src/app/(app)/page.tsx`**:
- Hero passa a mostrar **Saldo total convertido pra EUR** (primária hardcoded). Soma = `balanceEUR + convertCents(balanceBRL, BRL_EUR)`.
- Subtítulo (chips): `€ X · R$ Y · 1€ = R$ Z (dd/mm)`. Cotação do `rateDate`. Se `isStale=true`, prefixa "cotação de" no lugar de só "dd/mm".
- Se `FxUnavailableError`: hero volta pro saldo EUR sozinho (fallback atual) + chip discreto "Câmbio indisponível" (sem stack trace, sem barulho).

**/resumo `src/app/(app)/resumo/page.tsx`**:
- Card visual: adiciona linha **acima** do bloco "Contas:": `Total convertido: € 4.230,15 (R$ 25.380,90)`.
- Texto exportado: mesma linha inserida no bloco Contas, na primeira posição:
  ```
  Contas:
  - Total convertido: € 4.230,15 (R$ 25.380,90)
  - Itaú: R$ 1.820,00
  - Wise EUR: € 1.600,15
  ```
- Cotação NÃO entra no texto (polui WhatsApp). Só no card visual.
- Se `FxUnavailableError` OU se Tiago só tem contas de uma moeda: omite a linha (resto do resumo segue).

**Testes**:
- Unit: `convertCents` (arredondamento HALF_EVEN, edge cases).
- Unit com MSW: `getRate` (cache hit, cache miss → fetch, fetch falha → stale, fetch falha + cache > 7 dias → erro).
- Integração: round-trip via `fx_rates_cache` real (upsert + select).
- E2E: dashboard renderiza "Total convertido" quando há contas nas duas moedas.

### Fora (explicitamente)

- **Suporte a USD, GBP ou outras moedas** — só EUR e BRL. Frankfurter suporta, schema não.
- **Override manual da cotação via UI** — se a API falha por 8+ dias, ajusta direto via SQL/painel. UI custaria mais que o caso.
- **Histórico de cotações na UI** (gráfico EUR/BRL ao longo do tempo) — `fx_rates_cache` é detalhe técnico, não conteúdo do produto.
- **Conversão de transactions individuais** ("R$ 50 viraria € 8,17 em EUR") — só o saldo total e card de Contas usam câmbio. Transactions permanecem na sua currency.
- **Mudar a moeda primária do household via UI** — fica `EUR` hardcoded no v1. Se Laine ou Tiago decidem mudar, refactor pequeno + PRD nova.
- **Cron mensal de recorrentes** — outra frente (PRD 4).
- **Rota `/api/cron/fx` propriamente** — esta PRD entrega só a Server Action que o cron chama. O wiring do Vercel Cron entra na PRD 4 (que cobre todos os crons).
- **Cache TTL menor que 1 dia** (intraday, hourly) — não faz sentido pro caso de uso. Tiago não opera por cotação intraday.
- **Snapshots de saldo histórico** — `accounts.balance_cents` é current state. Histórico só via transactions.

## Abordagem proposta

`getRate` é função impura que combina leitura do cache (anon RLS) com escrita (service role) e fallback gracioso. Implementação em camadas: `fetchFromFrankfurter()` puro (HTTP), `readFromCache(supabase, base, quote, when)` puro (query), `getRate()` orquestra. Testes unitários mockam `fetchFromFrankfurter` via MSW e injetam supabase via dep injection (mesmo padrão dos cores existentes).

Dashboard e /resumo carregam `getRateMap()` no Server Component em paralelo com as outras queries. Se throw, o catch transforma em `{ rate: null }` e a UI sabe esconder o agregado. Sem suspense streaming v1.

Tabela `fx_rates_cache` já existe. Sem migration. Read via RLS pública; write via `createServiceRoleClient()` (novo helper em `src/lib/supabase/server.ts` se ainda não existir).

## Dependências

- **Schema**: pronto. Sem migration.
- **Service role key**: `SUPABASE_SERVICE_ROLE_KEY` já no `.env.local` e Vercel.
- **MSW** (Mock Service Worker): usado pra mockar frankfurter nos unit tests. Já listado como "MSW opcional" no CLAUDE.md — instalar agora (`npm i -D msw`).
- **PRD 4 (cron)** consome a Server Action; mas esta PRD não bloqueia: até o cron existir, o cache é populado on-demand na primeira request do dia.

## Riscos

- **Frankfurter offline por >7 dias**: probabilidade baixa (BCE oficial, alta uptime histórica), impacto médio (UI mostra "Câmbio indisponível", fallback EUR-só). Mitigação: fallback gracioso já no escopo, sem retry exponencial v1.
- **API retorna `date` < hoje em finais de semana**: probabilidade alta (toda sexta→segunda), impacto baixo (sexta é a última cotação BCE; o app aceita). Mitigação: armazena com `rate_date = today` (TTL diário simples), guarda a data real da API em `fetched_at` se precisar inspecionar.
- **Drift de arredondamento ao inverter (`1/rate`)**: probabilidade alta em valores grandes, impacto baixo (centavos sobram/somem). Mitigação: aceitar. Inversão só pra display de BRL convertido em EUR; valor canônico continua na currency original da conta.
- **Fetch sob demanda no Server Component da dashboard**: probabilidade média (primeira request do dia se o cron falhar), impacto baixo (latência +200-400ms pra primeira render do dia). Mitigação: cron pré-popula. Sem fetch fora do path crítico v1.
- **Multiple Server Components da mesma request disparando fetch simultâneo**: probabilidade baixa, impacto baixo (a unique key impede duplicata; corrida resulta em 1 erro UPSERT ignorado). Mitigação: usar `upsert` com `onConflict: rate_date,base,quote`. Aceitar.
- **Service role key vazando**: probabilidade baixa, impacto alto. Mitigação: helper `createServiceRoleClient()` só importável de `src/server/` ou `src/lib/fx/` (regra de lint customizada futura; v1 apenas convenção).
- **Dashboard ficar mais lento**: probabilidade média na primeira request do dia, baixa nas demais (cache hit). Aceitar. Adicionar timing log no helper pra observabilidade futura.

## Hipóteses a validar

- **"Total em EUR é o agregado que importa"**: Tiago vive em Portugal, recebe em EUR, então EUR é a "moeda do dia-a-dia". Mas se Laine ou ele dizem "mostra em BRL também", PRD futura adiciona toggle. Validar — se em 2 semanas vier pedido, refazer hero como par EUR+BRL.
- **"Cotação no chip (dd/mm) inspira confiança suficiente"**: alternativa seria mostrar "atualizada há X horas". Mais ruidoso. Validar — se Tiago perguntar "essa cotação é de quando?", mudar.
- **"Linha 'Total convertido' no texto do /resumo é útil pra Laine"**: pode ser que ela leia "Total: € X (R$ Y)" e fique confusa por sobrepor moedas. Validar com ela direto.
- **"Frankfurter cobre o caso"**: BCE oficial, atualizado dia útil ~16h UTC. Se aparecer caso de "preciso da cotação de Itaú/turismo" (spread comercial), refazer com API paga (mas fora do MVP).

## Open questions

- **Hero vs subtítulo**: hero passa a mostrar o total convertido e EUR/BRL viram chips abaixo? Ou mantém EUR como hero e adiciona "Total: € X" em segunda linha? → Resposta proposta: **hero = total convertido**, chips abaixo com breakdown + cotação. Maior contraste com o status quo. Confirmar.
- **`rate_date` = data de hoje (app) ou data retornada pela API (último útil)?** → Resposta proposta: **`rate_date = today`** (simplifica TTL). Data real da API persiste em `fetched_at`. Confirmar.
- **Inverter `1/rate` localmente ou pedir segunda fetch pra `BRL→EUR`?** → Resposta proposta: **inverter localmente**. Uma fetch, simétrica, aceita drift de centavos no display. Confirmar.
- **Texto do /resumo: incluir linha "Total convertido" mesmo quando household só tem contas em 1 moeda?** → Resposta proposta: **não** — só inclui se há ≥1 conta em cada moeda. Evita "Total: € X (R$ 0)". Confirmar.
- **Fetch sob demanda no SSR é aceitável (latência +200-400ms)?** → Resposta proposta: **sim no v1**, com a expectativa que o cron da PRD 4 elimine isso. Se latência incomodar antes do cron entrar, adicionar `'use cache' + cacheLife('1h')` no helper. Confirmar.
- **Erro de fetch + cache vazio: fallback ou hard error?** → Resposta proposta: **fallback silencioso** (mostra "Câmbio indisponível" como chip, hero volta pro EUR-só). Hard error quebraria o dashboard inteiro. Confirmar.
- **`FxUnavailableError` é uma classe nova ou apenas `throw new Error('FX_UNAVAILABLE')`?** → Resposta proposta: **classe nomeada**, facilita `if (err instanceof FxUnavailableError)` no catch da UI. Confirmar.
