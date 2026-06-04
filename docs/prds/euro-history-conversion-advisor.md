# Histórico do euro e conselheiro de conversão (Wise)

> Reverte uma decisão de `docs/prds/cambio.md`, que listou "histórico de cotações
> na UI (gráfico EUR/BRL ao longo do tempo)" como **fora de escopo** ("`fx_rates_cache`
> é detalhe técnico, não conteúdo do produto"). A premissa mudou: o owner quer
> acompanhar o momento do câmbio pra decidir quando converter pela Wise. O gráfico
> deixa de ser detalhe técnico e vira conteúdo.

## Problema

O owner converte dinheiro entre EUR e BRL pela Wise de tempos em tempos, e hoje
decide a hora de converter no escuro. Duas dores concretas:

1. **Não sabe se a taxa de hoje está boa ou ruim.** Sem ver a cotação dos últimos
   dias/meses, não tem referência pra dizer "1€ = R$ 6,40 está caro ou barato?".
   Acaba convertendo por necessidade, não por timing.
2. **Não sabe quanto a Wise come de spread.** A Wise cobra uma taxa embutida sobre
   a cotação do BCE; o owner não sabe quantificar. Toda conversão gera uma taxa
   efetiva (recebido ÷ enviado) que captura esse custo, mas esse dado se perde —
   nunca foi registrado em lugar nenhum.

Consequência: decisões de conversão sem base e sem aprendizado. Converte, esquece
a taxa, repete o ciclo no escuro.

## Usuário afetado

- **owner no dashboard** (peso alto, acompanhamento recorrente): mora em Portugal,
  recebe em EUR, manda dinheiro pra BRL (e ocasionalmente o contrário). Quer
  "olhar o euro" como quem olha cotação no app do banco, e ter um empurrão sobre
  se hoje é um bom momento **relativo** ao histórico recente e à última conversão.
- **owner no momento da conversão** (peso médio, esporádico): acabou de converter
  na Wise e quer registrar a taxa efetiva pra alimentar o aprendizado.

Não é pra: co-membro (a decisão de câmbio é do owner), trading/especulação,
previsão de cotação futura, terceira moeda.

## Métrica de sucesso

**O owner consulta o gráfico antes de converter e registra a conversão depois,
por 2 ciclos de conversão.** Medido por pergunta direta ("você olhou o histórico
antes da última conversão? registrou ela depois?"). Se ele converte sem olhar, o
card está mal posicionado ou não inspira confiança.

Sem métrica de negócio dura (uso pessoal, 1 decisor). Proxy técnico: existe ≥1
linha em `currency_conversions` 4 semanas após o deploy. Zero conversões
registradas = o registro tem fricção demais ou o owner não vê valor.

## Escopo

### Dentro

**Gráfico de histórico do euro** (`src/components/finance/euro-history-chart.tsx`):
- Linha única EUR→BRL ("quantos reais vale 1 euro") ao longo do tempo.
- Seletor de período **7 dias / 30 dias / 1 ano**. Recebe a série de 1 ano e fatia
  client-side por período.
- Recharts, clonando estilo/CSS-vars de `balance-trend-chart.tsx`. Conecta só os
  pontos disponíveis (frankfurter só tem dia de pregão; fins de semana/feriado são
  gaps). Posicionado no **rodapé do dashboard, com menos destaque** (eyebrow
  discreto, sem hero).

**Histórico de taxas** (`src/lib/fx/history.ts`):
- `getRateHistory({ base, quote, from, to })`: lê `fx_rates_cache` no intervalo;
  se há gap no começo ou no fim, faz **uma** chamada à série histórica do
  frankfurter (`https://api.frankfurter.dev/v1/{from}..{to}?from=EUR&to=BRL`),
  upsert via service role, relê. Backfill do ano roda uma vez; em estado estável
  o cron já aquece "hoje" e a maioria das cargas não dispara fetch. Fetch falhou →
  retorna o que o cache tiver (graceful, como o `isStale` atual).
- `getRateOn(date)`: taxa de uma data passada (cache → frankfurter single-date →
  upsert). Usado pra preencher `mid_market_rate` no registro de conversão.

**Registro de conversões** (tabela `currency_conversions`, migration 0011; actions
em `src/server/actions/conversions/`):
- **Referência pura: NÃO mexe em saldo de conta.** Grava `from_currency`,
  `to_currency`, `from_amount_cents`, `to_amount_cents`, `effective_rate` (= to/from),
  `mid_market_rate` (BCE do dia, from→to, best-effort), `converted_on`, `note`.
- `recordConversionAction` (Zod, moedas distintas, valores > 0) e
  `deleteConversionAction`. RLS por household.
- Form em dialog/sheet espelhando `lancar-form.tsx` (parse de centavos, toast).
  Lista compacta das últimas conversões com excluir.

**Sinal "bom momento para converter"** (`src/lib/fx/conversion-advice.ts`, função
pura):
- `wiseSpreadPct`: média de `(mid - effective)/mid` das conversões com
  `mid_market_rate`. `null` se nenhuma.
- `netEurBrl` / `netBrlEur`: taxa atual já descontada do spread (estimativa do que
  receberia de fato hoje na Wise).
- `windowPosition`: percentil da taxa atual na janela recente (~90 dias). Topo →
  favorável a EUR→BRL; fundo → favorável a BRL→EUR; meio → neutro.
- `signal`: `convert_eur_to_brl | convert_brl_to_eur | neutral` com força.
- `comparisonToLast`: % melhor/pior que a última conversão de cada direção.
- Card `conversion-signal-card.tsx` mostra sinal + taxa BCE hoje + taxa estimada
  Wise + posição na janela + comparação com a última conversão.

**Testes** (TDD outside-in, ver `docs/tdd.md`):
- Unit: `conversion-advice` (spread, percentil, direção, bordas); `effective_rate`;
  helper de detecção de gap do `getRateHistory`.
- Integração: `recordConversionCore` (insere, isola por household, backfill de
  `mid_market_rate`), `deleteConversionCore`.
- Componente: validação do form; toggle de período do chart.
- E2E: dashboard → ver gráfico no rodapé → trocar período → registrar conversão →
  ver sinal + comparação.

### Fora (explicitamente)

- **Previsão de cotação futura.** O sinal é descritivo (taxa atual vs histórico
  recente e vs última conversão), nunca preditivo. A copy não pode sugerir "o euro
  vai subir/cair". Prometer previsão de câmbio seria desonesto.
- **Mover saldo no registro de conversão.** Decisão do owner: registro é só
  referência. Se ele quiser refletir a conversão nos saldos, ajusta as contas por
  fora (ou usa o fluxo de transação existente). Misturar os dois é outra PRD.
- **Câmbio intraday / por hora.** Frankfurter é diário (BCE ~16h UTC). Um ponto por
  dia basta pro caso.
- **Terceira moeda (USD, GBP).** Só EUR↔BRL, como no resto do app.
- **Spread por corredor/valor da Wise (taxa real-time da API da Wise).** Estimamos
  o spread a partir do histórico do próprio owner, não consultamos a Wise. Se a
  estimativa divergir muito do real, revisita.
- **Alertas/push "a taxa atingiu X".** O sinal é pull (owner abre o dashboard), não
  push. Notificação é outra frente.
- **Editar uma conversão registrada.** Só criar e excluir no v1. Errou? Exclui e
  registra de novo.
- **Override manual da taxa BCE.** Igual ao `cambio.md`: se frankfurter falhar
  muito, ajusta via SQL.

## Abordagem proposta

Reúso máximo do FX existente (`getRate`/`getRateMap`/`convertCents` em
`src/lib/fx/index.ts`) e do `fx_rates_cache`. `getRateHistory` estende a mesma
ideia de "cache-first com fetch sob demanda", agora pra intervalos, usando o
endpoint de série histórica do frankfurter (confirmado: `frankfurter.dev/v1/{start}..{end}`,
um ponto por dia de pregão). A inteligência é uma **função pura** isolada
(`conversion-advice.ts`), testável a fundo por unit, sem I/O. Server Component
`fx-block.tsx` carrega tudo via loader `cache()`-wrapped (padrão `dashboard-data.ts`)
e compõe os três cards no rodapé do dashboard.

`effective_rate` e `mid_market_rate` armazenados **ambos em from→to**, pra que
`spread = (mid - effective)/mid` saia uniforme nas duas direções de conversão.

## Dependências

- **Schema**: nova migration `0011_currency_conversions.sql` + regen de
  `src/types/database.ts`. **Atenção**: schema de prod foi aplicado manualmente e
  está dessincronizado do tracking — aplicar em prod é passo manual do owner, sem
  `supabase db push`.
- **Recharts**: já é dependência (v3.8.1).
- **Service role key**: já em uso pelo FX atual (upsert no cache).
- **frankfurter.dev**: novo host (o `/latest` atual segue em `.app`; séries
  históricas redirecionam pra `.dev`). Sem chave.

## Riscos

- **Backfill do ano lento na primeira carga**: probabilidade alta (1 fetch de ~250
  pontos na primeira vez que alguém abre a visão 1y), impacto baixo (uma vez só,
  depois cacheado). Mitigação: fetch único por intervalo faltante; chart renderiza
  o que tiver enquanto isso. Aceitar.
- **frankfurter.dev muda contrato/host de novo**: probabilidade baixa, impacto médio
  (gráfico e backfill quebram). Mitigação: fetch tolerante a erro (retorna cache);
  endpoint isolado num helper só.
- **Sinal mal interpretado como previsão**: probabilidade média, impacto alto
  (owner converte achando que "vai subir" e perde). Mitigação: copy explícita de
  "relativo ao histórico recente", sem verbo de futuro. Validar a copy com o owner.
- **Spread estimado impreciso com poucas conversões**: probabilidade alta no começo
  (1-2 registros), impacto baixo (estimativa melhora com o uso; com 0 registros,
  `wiseSpreadPct = null` e o card mostra só a taxa BCE). Mitigação: degradar
  graciosamente, sinalizar "estimativa baseada em N conversões".
- **`mid_market_rate` indisponível pra `converted_on` antigo**: probabilidade média
  (data sem pregão ou fetch falho), impacto baixo (fica `null`, conversão entra sem
  contribuir pro spread). Aceitar.
- **Drift de arredondamento ao inverter taxas**: igual ao `cambio.md` — aceitar,
  só display.

## Hipóteses a validar

- **"O owner quer um sinal, não só o gráfico crú."** Pode ser que o gráfico sozinho
  já baste e o card de sinal vire ruído. Validar: se ele ignora o card e só olha a
  linha, simplificar pra só o gráfico + spread.
- **"Spread estimado do próprio histórico é bom o suficiente."** A Wise varia o
  spread por valor/corredor. Se a estimativa errar feio vs o que ele recebe,
  considerar puxar a taxa real da Wise (fora do MVP).
- **"Janela de ~90 dias é a referência certa pro percentil."** Curta demais ignora
  tendência; longa demais dilui o momento. Validar com uso; é um número fácil de
  ajustar.
- **"Registro manual tem fricção aceitável."** Se o owner não registra, o
  aprendizado morre. Validar pelo proxy (≥1 conversão em 4 semanas).

## Open questions

- **Limiar do percentil pro sinal disparar** (ex.: ≥70 favorece EUR→BRL, ≤30 favorece
  BRL→EUR)? → Proposta: **70/30**, banda neutra no meio. Fácil de ajustar. Confirmar
  após ver dados reais.
- **Janela do percentil = 90 dias?** → Proposta: **90 dias**. Confirmar com uso.
- **Card de sinal sempre visível ou só quando há conversões registradas?** →
  Proposta: **sempre** — sem conversões, mostra gráfico + taxa BCE e um convite a
  registrar a primeira; com conversões, liga o spread e a comparação. Confirmar.
- **`from`/`to` no form como par de moedas (EUR→BRL) ou como duas contas?** →
  Proposta: **par de moedas** (registro é referência, não toca contas). Confirmar.
