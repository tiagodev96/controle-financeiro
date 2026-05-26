# Sugestão de pagamento de dívida no dashboard

## Problema

owner tem dívidas em aberto e sobra prevista positiva no mês, mas hoje precisa abrir /dividas, lembrar quais existem, calcular mental "se tenho € 200 sobrando, posso pagar ~60% disso na dívida prioritária". Três efeitos:

1. **Sobra prevista vira gasto não-intencional**: sem nudge, o dinheiro evapora em consumo.
2. **Quitação fica sempre adiada**: prioridade alta nunca diminui porque não há sinal pra agir.
3. **Não tem botão "pagar X% da Jefferson agora"**: clica em /dividas, escolhe, digita valor, registra. 4 passos.

## Usuário afetado

- **owner no dashboard** (peso alto, diário): vê sobra positiva → vê sugestão → 1 clique abre dialog pré-preenchido com valor + dívida sugeridos.
- **owner/co-membro sem sobra ou sem dívida**: não vê nada. Sem ruído.

Não é pra: análise complexa (juros, risco), sugestão multi-dívida ("R$ Y na Jefferson + R$ Z no Cartão").

## Métrica de sucesso

**≥ 1 pagamento registrado via sugestão do dashboard nas primeiras 2 semanas pós-deploy.** Medido por contagem de transactions com `source_debt_id` criadas a partir do botão do card (vs criadas via /dividas direto). Se zero em 2 semanas, sugestão não convence ou está mal posicionada.

Proxy direto: card aparece quando deveria (sobra > 50 e ≥ 1 dívida open) e some quando não.

## Escopo

### Dentro

**Heurística (helper puro em `src/lib/finance/debt-suggestion.ts`)**:
- Input: `sobraEUR` (sobra prevista em EUR, hardcoded primária), `openDebts[]`, `fxRateMap?` (pra converter dívida BRL pra EUR).
- Output: `null` OU `{ debt, suggestedCents, percOfDebt }`.
- Algoritmo (espelha §6.3 do spec):
  ```
  sobraEUR < 5000 (= € 50) → null  (ticket mínimo)
  ordena openDebts por priority asc, remaining desc (igual /dividas)
  pra cada dívida:
    remainingEmEUR = converte se BRL→EUR via fxRateMap (ou null se não tem fxRateMap)
    maxAplicavel = sobraEUR * 0.6  (configurável via constante)
    suggested = min(maxAplicavel, remainingEmEUR)
    se suggested >= 5000 e remainingEmEUR > 0:
      retorna { debt, suggestedCents (na currency da dívida), percOfDebt }
  retorna null se nenhuma cabe
  ```
- Se dívida é BRL: converte sobraEUR pra BRL via `fxRateMap.EUR_BRL` no cálculo, retorna suggestedCents em BRL (consistente com currency da transaction-pagamento).

**Card no dashboard**:
- Componente server `<DebtSuggestionCard suggestion={...} />` renderizado abaixo de StatTrio, antes de Top categorias.
- Conteúdo:
  - Eyebrow: "Sugestão"
  - Linha 1: "Sua sobra prevista é € X. Sugestão: pagar [Num] em [debt.title]."
  - Linha 2 (sublabel): "{percOfDebt}% da dívida"
  - Botão primary brass "Registrar pagamento" → abre `<RegisterPaymentDialog>` já existente, com valor pré-preenchido.
- Se `suggestion === null`: card não renderiza. Sem placeholder.

**Reuso do dialog existente**:
- `<RegisterPaymentDialog>` já aceita `valor` (MoneyInput default `remaining`). Adicionar prop opcional `initialValueCents` que override o default.
- Ao abrir do dashboard, valor virá pré-preenchido com `suggestedCents`.

### Fora (explicitamente)

- **Sugestão multi-dívida** ("R$ A em X + R$ B em Y") — single-debt v1.
- **Constante do teto (60%) editável via UI** — fica hardcoded em `MAX_RATIO = 0.6`.
- **Sugestão em /dividas direto** — só no dashboard.
- **Toast/banner agressivo** ("você tem sobra, quita já!") — sem ruído. Card discreto.
- **Histórico de sugestões aceitas/recusadas** — overkill.
- **Considerar transactions futuras (parcelas, recorrentes)** já estão dentro da sobra prevista existente; sem mudança de fórmula.
- **Currency mismatch entre sobra (EUR) e dívida (BRL)**: converte usando fxRateMap. Se fx indisponível, ignora dívidas BRL pra heurística (só sugere EUR). Sem hard error.
- **Card no dashboard quando preferred_display_currency = BRL**: continua usando sobra EUR como base (sobra é calculada em EUR pelo stats helper). Display do valor sugerido respeita a currency da dívida.

## Abordagem proposta

Função pura `computeDebtSuggestion()` testável sem Supabase. Dashboard server-component chama o helper com os dados que já carrega (stats.sobraPrevistaCents, openDebts, fxRateMap). Renderiza condicionalmente. Dialog reusa o existente com prop extra.

## Dependências

- **Helpers existentes**: `listDebtsForHousehold`, `getRateMap`, `calculateMonthStats`.
- **Sonner**: toast pós-submit do dialog (já implementado).
- **Nada novo**: sem migration, sem dependência.

## Riscos

- **Heurística sugerir valor que esgota a sobra**: probabilidade média (owner aceita, fica sem buffer). Mitigação: teto 60%, deixa 40% pra outras coisas. Aceitar.
- **Confusão se aparece e some dia-a-dia** (sobra flutua): probabilidade média, impacto baixo. Aceitar — sumir é informação, não bug.
- **Conversão imprecisa em BRL→EUR**: probabilidade alta em valores grandes, impacto baixo (centavos). Aceitar.
- **owner aceita e depois cancela a transaction**: o trigger de debt remaining recalcula sozinho. Aceitar.

## Hipóteses a validar

- **"€ 50 é ticket mínimo razoável"**: valor arbitrário. Se owner nunca clica porque "só € 60 não vale a pena cadastrar", subir pra € 100. Se acha pouco, baixar. Validar com uso.
- **"60% do teto é proporção ok"**: se owner sempre clica mas depois edita pra mais/menos, recalibrar.
- **"Card discreto vs CTA chamativo"**: começamos discreto. Se ele ignora, testar versão mais destacada.

## Open questions

- **`MAX_RATIO=0.6` é constante boa?** → Proposta: sim, espelha o spec. Confirmar.
- **Ordem das dívidas para escolher**: priority asc + remaining desc (consistente com /dividas) ou priority asc + remaining asc (quita mais barata primeiro)?
  → Proposta: **priority asc + remaining desc** (consistência). Confirmar.
- **Card some quando sobra = 0?** → Proposta: **sim**, sem dado pra sugerir. Confirmar.
- **Quando fxRateMap indisponível e única dívida open é BRL**: card some, ou mostra com warning?
  → Proposta: **some silencioso**. Sem ruído. Confirmar.
- **Botão "Registrar pagamento" abre o mesmo dialog de /dividas ou inline mini-dialog do dashboard?**
  → Proposta: **mesmo dialog**, mais código reusado. Confirmar.
