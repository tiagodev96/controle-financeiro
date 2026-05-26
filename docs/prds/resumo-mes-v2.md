# Resumo do mês v2 — imagem PNG + selector de mês + toggle EUR/BRL

> Sucessora de `docs/prds/resumo-mes.md` (v1, entregue). Não substitui a v1: amplia. Texto exportável continua existindo como fallback; imagem vira ação primária.

## Problema

Quando Tiago manda o resumo no grupo da família no WhatsApp, o texto cru polui o chat — fica imerso entre mensagens, perde hierarquia visual, e a Laine precisa rolar pra cima/baixo pra mostrar o número certo pra outros familiares. Resultado: **a foto/print do dashboard é o que ela acaba mandando em paralelo**, anulando o ponto do export.

Em cima disso, dois recortes do v1 viraram dor real após uso:

1. **Só mostra o mês corrente**: dia 5 do mês seguinte, Tiago quer mandar "como foi abril" e não tem como (só vê maio em andamento, com números incompletos).
2. **EUR hardcoded como moeda primária**: entradas, despesas, top categorias e sobra ignoram qualquer transaction em BRL. Pra household 100% EUR é OK; pra household mixed (que é o caso real), o resumo mente.

## Usuário afetado

- **Tiago, fim do mês corrente ou primeira semana do seguinte** (peso alto, frequência mensal): hoje copia texto do v1 e cola. Quer mandar imagem porque "fica feio em texto". Caso de uso central da v2.
- **Tiago, retroativo** (peso médio, eventual): no dia 3-5 do mês seguinte abre /resumo querendo ver o mês fechado, não o atual em andamento. Hoje precisa esperar virar mês.
- **Laine, consumindo no grupo da família** (peso médio): hoje precisa fazer screenshot da mensagem de texto pra repassar visualmente. Com PNG nativo, repassa direto.
- **Tiago em household real (BRL + EUR)** (peso alto, presente sempre): quer alternar EUR/BRL pra mandar uma versão pra família portuguesa e outra pra brasileira, ou só ver "em reais quanto deu".

Não é pra: comparar dois meses lado a lado, gerar relatório fiscal, ou compartilhar com terceiros que não estão no household.

## Métrica de sucesso

**Tiago substitui o screenshot do dashboard pelo PNG do /resumo nas 2 trocas seguintes pós-deploy**. Medido por pergunta direta a ele 30 dias depois: "qual foi a última imagem que você mandou no grupo — o PNG do app ou um print?". Se ainda é print, o PNG não convence (formato errado, números errados, ou fricção alta demais).

Proxy direto:
- /resumo aberto ≥1× com `mes=<mes-anterior>` nos primeiros 60 dias (confirma que selector de mês é usado).
- Botão "Compartilhar imagem" clicado ≥2× (confirma que a ação primária funciona).

## Escopo

### Dentro

**Página /resumo (refactor)**:
- Header AppTopBar trailing: novo `<MonthPicker>` (mesmo componente já consolidado no dashboard) + toggle EUR/BRL ao lado.
- URL param `?mes=YYYY-MM`. Default = mês corrente. Range mínimo: mês corrente + anterior. Range estendido (futuro): se viável sem complicar muito, abre até `today + 12 meses`.
- URL param `?moeda=eur|brl`. Default = `eur`. Estado local da página, não persiste cross-session.
- Card resumo visual existente passa a converter via `fxRateMap` quando `moeda=brl` é selecionada (saldo previsto, sobra, entradas/despesas, top categorias). **Dívidas e contas continuam na currency original** (semântica "isso é dinheiro real ainda devido / disponível em X").
- Empty state se mês selecionado não tem dados: card neutro "Sem dados para {mês}" — sem CTA "lançar despesa" se for mês passado (não faz sentido).

**Mês passado vs corrente vs futuro**:
- **Passado**: usa transactions reais (paid + pending), `pending` que ficou em pé é mostrado como "esquecido". Sobra prevista vira "Sobra do mês" (resultado real, não projeção). Esconde widgets só-de-futuro (sugestão de dívida).
- **Corrente**: comportamento atual do v1 — projeção + saldo manual atual.
- **Futuro** (se entrar no escopo): projeta usando `recurring_rules` ativas + `installment_plans` com parcela vencendo no mês + total de dívidas com priority alta. "Sobra prevista" vira "Sobra projetada" com label explícita.

**Botão "Compartilhar imagem" (substitui "Compartilhar resumo" como primary)**:
- Client component. Faz `fetch` do route handler `GET /api/resumo/og?mes={mes}&moeda={moeda}` que retorna PNG.
- Em mobile com Web Share API: chama `navigator.share({ files: [pngFile] })`.
- Em desktop ou navegador sem share-de-files: baixa o PNG (`<a download>`).
- Se a geração falhar (timeout, edge crash): toast "Imagem indisponível, copie o texto" + foca no botão secundário.

**Botão "Copiar texto" (mantém como secondary)**:
- Inalterado do v1.

**Route handler `GET /api/resumo/og`** (edge runtime, `runtime = 'edge'`):
- Params: `mes` (YYYY-MM), `moeda` (eur|brl). Defaults se faltam: mês corrente, EUR.
- Resolve session via cookie SSR. Mesma proteção do resto do app — sem session válida, 401.
- Carrega mesmos dados do server component (`calculateMonthStats`, `topCategoriesThisMonth`, `listDebtsForHousehold`, `listAllAccountsForHousehold`, `fxRateMap`).
- Renderiza JSX → PNG via `@vercel/og` (`new ImageResponse(<Layout />)`).
- Layout vertical 1080×1350 (proporção 4:5, igual ao Instagram feed vertical — funciona bem em preview do WhatsApp). Usa tokens canônicos do design system (wine borgonha brand, sage positivo, clay negativo, fg warm).
- Sem emoji na imagem (regra do projeto). Headers/labels em sentence case, números com tabular-nums.

**Fontes pra @vercel/og**:
- Geist (regular + bold) + JetBrains Mono (regular + bold) pre-bundled como `.woff2` em `public/fonts/og/`. Carregados via `fetch` no route handler.

### Fora (explicitamente)

- **Mês comparativo**: "abril vs março" lado a lado na mesma imagem. Vira PRD `resumo-mes-v3.md` se aparecer dor. Tradeoff: layout fica apertado, e quem quer comparativo vai pro dashboard navegando por meses.
- **PNG customizável via UI** (cores, ordem das seções, esconder X): design é fixo. Se aparecer dor, vira PRD própria.
- **Selector de moeda persistente cross-session**: fica local à URL (`?moeda=brl`). Cookie/profile preference seria overkill — usuário troca uma vez por share, não vale persistir.
- **Suporte a outras moedas além de EUR/BRL**: schema só tem EUR e BRL. Sem caso de uso.
- **Compartilhar via deep link de app específico** (`whatsapp://send?...`): Web Share API + download cobrem. Deep link é fragil, depende do app instalado.
- **Renderização server-side da imagem em loop (cache)**: cada share é on-demand. Volume = ~1-2 shares/mês × 2 usuários. Não vale cache.
- **PNG horizontal** (proporção 16:9 ou story 9:16): fixo em 4:5 vertical, otimizado pra WhatsApp e Telegram inline preview.
- **Histórico de imagens geradas**: re-gera on-demand. Sem storage.
- **Email / agendamento "manda automaticamente todo dia 1"**: manual, abre o app.
- **Resumo semanal ou de período arbitrário**: só mensal v2.
- **Adicionar emoji na imagem pra cobrir tradição do texto (4 emojis funcionais)**: imagem tem ícones SVG nativos do Lucide, não precisa de emoji.

## Abordagem proposta

Três frentes paralelas, dependentes da mesma refatoração base:

1. **Refatorar `/resumo` page pra aceitar `searchParams`** (mes + moeda), passar `targetDate` pra `calculateMonthStats` e `topCategoriesThisMonth` (já aceitam), e passar `fxRateMap` + currency selecionada pro card visual converter sob demanda. Mesmo padrão do dashboard (item 4 do backlog smoke v1, já entregue) — copia o `parseMonthParam` helper.
2. **Adicionar `MonthPicker` + `CurrencyToggle` no AppTopBar trailing**. Componentes já existem (DashboardMonthPicker e CurrencyToggle). DashboardMonthPicker faz push pra `/`; precisa generalizar pra aceitar base path como prop, ou criar `ResumoMonthPicker` que dá push pra `/resumo?mes=...`. CurrencyToggle hoje persiste a preferência via server action — pra /resumo precisa de uma variante que só atualiza a URL.
3. **Construir route handler `GET /api/resumo/og`** com `@vercel/og`. Reusa as mesmas funções de loading de dados do server component (extraídas pra helper se necessário). Layout JSX próprio em `src/components/finance/resumo/og-layout.tsx` (server-side, sem hooks, só JSX puro com inline styles pra @vercel/og).

Tradeoff principal: **incluir mês futuro ou não**. Phase 1 (este PRD): mês corrente + 1 anterior. Phase 2 (após validar o caminho com Tiago): expande pra futuro com projeção. Decisão isolada — não bloqueia o PNG/toggle moeda/mês anterior.

## Dependências

- **Novo pacote**: `@vercel/og` (oficial Next.js, ~50KB no edge bundle). Sem outras transitive deps relevantes.
- **Fontes locais**: Geist + JetBrains Mono em `.woff2` baixadas uma vez e commitadas em `public/fonts/og/`. Cada arquivo ~30-50KB. Tradeoff: deploy bundle cresce ~200KB; alternativa é fetchar do Google Fonts no edge (rede + risco de falha).
- **Helpers existentes**: `calculateMonthStats` (já aceita targetDate via item 4), `topCategoriesThisMonth` (idem), `listDebtsForHousehold`, `listAllAccountsForHousehold`, `getRateMap`, `convertCents`, `MonthInput`, `DashboardMonthPicker`. Reaproveita tudo.
- **Web Share API com files**: iOS Safari 15+, Android Chrome 89+. Fallback download cobre o resto.
- **Service-role Supabase no edge**: precisa confirmar que o route handler com `runtime = 'edge'` consegue usar cookies de sessão e o supabase-js no edge. Se não der, fallback pro Node runtime (mais lento, mas funcional pra volume baixo).

## Riscos

- **@vercel/og crasha no edge com fonte custom**: probabilidade média (configuração de fonte é histórico ponto de dor da lib), impacto alto (sem PNG = feature morta). Mitigação: começar com fonte padrão system, validar render fim-a-fim, depois adicionar Geist. Se a fonte custom quebrar, fica system-ui como fallback aceitável.
- **PNG fica ilegível no preview do WhatsApp**: probabilidade média (compressão agressiva do WhatsApp pode borrar números), impacto alto (mata o ponto da feature). Mitigação: validar visualmente no primeiro deploy enviando pra Tiago + Laine. Se ilegível, aumentar font-size dos números-chave (números maiores são prioridade #1 da imagem) ou trocar de 1080×1350 pra 1200×1500.
- **Sessão Supabase falha no edge runtime**: probabilidade média, impacto alto. Mitigação: testar localmente com edge runtime; fallback automático pra Node runtime se cookie SSR não funcionar (perde performance, mantém funcionalidade).
- **Custo de compute no Vercel**: edge functions cobram por invocation. Volume = 2 shares/mês × 2 usuários = ~4 invocations/mês. Custo trivial (<$0.01).
- **Currency toggle no /resumo confunde** (Laine vê BRL e acha que é saldo real em BRL, não conversão): probabilidade média, impacto médio. Mitigação: copy explícita no header "valores convertidos via cotação BCE de {data}" quando moeda != currency original da conta principal.
- **Mês passado com pending entries esquecidos** (transação que ficou pending por meses) sujam o resumo retroativo: probabilidade alta (Tiago esquece de marcar como pago às vezes), impacto médio (resumo tem ruído). Mitigação: na imagem, agrupar pending sob "Esquecidos" se mês é passado, em vez de misturar com "Pendente" (que só faz sentido pro mês corrente).
- **Fonte custom no edge bundle estoura 1MB**: probabilidade baixa (Geist+Mono = ~200KB), impacto alto (deploy quebra). Mitigação: medir antes de commit; usar só weights necessários (regular + bold, sem light/medium/semibold).

## Hipóteses a validar

- **"PNG vai substituir o screenshot do dashboard"** — premissa central. Se Tiago testa e diz "ainda prefiro print do dashboard porque mostra X que o PNG não mostra", a v2 falhou — precisa entender o que o dashboard tem que o resumo não. Validar nas primeiras 2 mensagens pós-deploy.
- **"Layout vertical 1080×1350 é o formato certo"** — proporção 4:5 funciona em feed do Insta e preview do WhatsApp. Se preview do WhatsApp cortar partes importantes (cabeçalho ou rodapé), trocar pra 1080×1920 (story 9:16) ou 1200×1500.
- **"Selector de mês corrente + anterior é suficiente"** — Tiago abre /resumo dia 28-31 do mês corrente OU dia 3-5 do mês seguinte. Esses dois casos cobrem 90%+. Se ele pedir "preciso ver fevereiro" três meses depois, expandir o range pra 12 meses retroativos é trivial.
- **"Mês futuro vale a complexidade"** — projeção é cara (regras de quais recurring entram, como tratar parcelas com data exata, como mostrar dívidas como "potencial"). Validar antes de buildar: pergunta direta a Tiago se ele usaria "ver junho antes de junho chegar" ou se isso é noise.
- **"Toggle EUR/BRL na URL é discoverable"** — colocar como botão visível no header (mesmo padrão do CurrencyToggle no dashboard) deve ser óbvio. Se Tiago não notar, repensar UI (talvez dois botões "compartilhar em EUR" / "compartilhar em BRL" em vez de toggle).

## Decisões fechadas (26/mai/2026)

- **Mês futuro entra na v2** (não fica pra v2.1). MonthPicker abre passado + corrente + futuro até `today + 12 meses`. Mês futuro projeta usando `recurring_rules` ativas + `installment_plans` com parcela vencendo + dívidas em aberto. "Sobra prevista" vira "Sobra projetada" com label explícita.
- **Fontes bundladas** em `public/fonts/og/` (Geist regular+bold + JetBrains Mono regular+bold ≈ 200KB de woff2). Edge tem que ser confiável; fetch de Google Fonts tem latência + risco de timeout + histórico ruim com `@vercel/og`.
- **PNG 1080×1350 (4:5 vertical)**. Caso de uso é mensagem inline no chat — preview proporcional sem cortar. 9:16 (story) ficaria comprido demais no chat.
- **Empty state**: route handler retorna **204 No Content**; UI detecta e desabilita o botão "Compartilhar imagem" com tooltip "Sem dados pra compartilhar".
- **Pending de mês passado** vai com label separada "Pendente esquecido: € X (Y itens)" — sinaliza pra Tiago marcar como pago antes de mandar a Laine.
- **Toggle EUR/BRL afeta o PNG**. Os params do route handler são `mes` + `moeda`; o PNG reflete a tela.
- **Web Share API com files em mobile; download direto em desktop** ou navegador sem `share` de files. Sem preview intermediário custom.

## Open questions

Nenhuma pendente — todas as questões iniciais foram resolvidas em 26/mai/2026. Se aparecer durante o build, anexar aqui.
