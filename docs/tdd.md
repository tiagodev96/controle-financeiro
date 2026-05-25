# TDD outside-in — guia prático deste projeto

> Este projeto roda TDD obrigatório, estilo outside-in ("testing trophy"). Documento curto pra você (e o Claude Code) lembrarem o ciclo e ver o método aplicado num exemplo concreto.

---

## Por que outside-in (e não a pirâmide clássica)

Pirâmide tradicional: muitos unit tests, alguns de integração, pouquíssimos E2E. Funciona bem em sistemas com muita lógica de domínio pura. Mal em apps CRUD modernos (Next.js + Supabase) porque a maioria dos bugs reais mora **entre as camadas** — Server Action que esquece `await`, RLS que bloqueia query silenciosamente, Server Component que renderiza dado stale. Unit tests não pegam nada disso.

Testing trophy (Kent C. Dodds): **integração no centro**, E2E pra fluxos críticos, unit pras funções extraídas. Cobre os bugs caros sem o custo de mockar o universo.

---

## As 4 camadas neste projeto

| Camada | Ferramenta | Cobre | Quando escrever |
|---|---|---|---|
| E2E | Playwright | Fluxos do usuário ponta a ponta | Antes de implementar feature visível |
| Integração | Vitest + Supabase local | Server Actions, queries, triggers, heurísticas com efeito colateral | Antes de implementar lógica de servidor |
| Unit | Vitest | Funções puras em `src/lib/` | Depois de extrair, durante o refactor |
| Componente | Vitest + RTL | Client components com lógica não-trivial | Sob demanda, não automático |

**Não testamos:**
- Server Components renderizados (a cobertura vem do E2E).
- Componentes de display sem lógica (use snapshot só se precisar).
- Estilo / CSS (visual regression é outro problema).

---

## O loop por feature

```
1. write-spec    → docs/prds/<feature>.md     (problema, escopo, aceite)
2. testing-strategy → quais camadas, quais cenários
3. E2E ou integração test → red
4. implementação mínima → green
5. refactor + extrai → src/lib/ com unit tests próprios
6. code-review skill antes do commit
```

Nunca pule etapas. Se a feature é puramente visual (ex.: ajuste de espaçamento numa página existente), pode pular pro passo 4 — mas declare isso no commit.

---

## Exemplo completo — "Lançar despesa rápida"

### Passo 1 — PRD

Invoca `product-management:write-spec`:

> Use product-management:write-spec pra produzir docs/prds/lancar-despesa.md sobre o fluxo de lançamento rápido descrito em docs/spec.md §5.1.

Resultado abreviado em `docs/prds/lancar-despesa.md`:
- Problema: lançar despesa no celular precisa ser <10s.
- Escopo: form mobile-first com valor, descrição, categoria, conta, status, data. Submit cria transaction.
- Não-escopo: edição inline, upload de comprovante, divisão de despesa.
- Aceite: usuário autenticado abre `/lancar`, preenche, submete; transaction aparece em `/transacoes`; dashboard reflete previsão atualizada.

### Passo 2 — Estratégia de teste

Invoca `engineering:testing-strategy`:

> Use engineering:testing-strategy pra planejar testes da feature em docs/prds/lancar-despesa.md.

Saída:
- E2E (1 teste): fluxo happy path — login → /lancar → preenche → submete → assert na listagem.
- Integração (3 testes): Server Action `createTransaction`:
  - cria transaction com campos corretos
  - rejeita valor negativo ou zero
  - falha se categoria não pertence ao household (RLS test)
- Unit (2 testes): `parseMoneyInput("12,50")` retorna `1250`; `parseMoneyInput("1.240,50")` retorna `124050`.

### Passo 3 — Red

`tests/e2e/lancar-despesa.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('lança despesa rápida e aparece na lista', async ({ page }) => {
  await page.goto('/login');
  await signInAsFixtureUser(page);             // helper que faz magic link mock

  await page.goto('/lancar');
  await page.getByLabel('Valor').fill('12,50');
  await page.getByLabel('Descrição').fill('Café no Starbucks');
  await page.getByRole('button', { name: 'Mercado' }).click();
  await page.getByRole('button', { name: 'Lançar' }).click();

  await expect(page).toHaveURL('/');
  await page.goto('/transacoes');
  await expect(page.getByText('Café no Starbucks')).toBeVisible();
  await expect(page.getByText('€ 12,50')).toBeVisible();
});
```

Roda `npm run test:e2e` → red (página `/lancar` ainda não existe).

`src/server/actions/transactions/create.test.ts` (integração):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTransaction } from './create';
import { resetTestDb, seedHousehold, authAs } from '@/tests/helpers';

describe('createTransaction', () => {
  beforeEach(resetTestDb);

  it('cria uma despesa com os campos corretos', async () => {
    const { profileId, categoryId, accountId } = await seedHousehold();
    await authAs(profileId);

    const result = await createTransaction({
      amount_cents: 1250,
      currency: 'EUR',
      description: 'Café',
      category_id: categoryId,
      account_id: accountId,
      direction: 'expense',
      occurred_on: '2026-05-24',
    });

    expect(result.ok).toBe(true);
    expect(result.transaction.amount_cents).toBe(1250);
    expect(result.transaction.status).toBe('pending');
  });

  it('rejeita valor zero', async () => {
    const { profileId, categoryId, accountId } = await seedHousehold();
    await authAs(profileId);

    const result = await createTransaction({
      amount_cents: 0,
      currency: 'EUR',
      description: 'x',
      category_id: categoryId,
      account_id: accountId,
      direction: 'expense',
      occurred_on: '2026-05-24',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valor/i);
  });
});
```

Roda `npm test` → red (action não existe).

### Passo 4 — Green

Cria `src/server/actions/transactions/create.ts` mínimo:

```ts
'use server';
import { z } from 'zod';
import { getServerClient } from '@/lib/supabase/server';

const schema = z.object({
  amount_cents: z.number().int().positive(),
  currency: z.enum(['EUR', 'BRL']),
  description: z.string().min(1),
  category_id: z.string().uuid(),
  account_id: z.string().uuid(),
  direction: z.enum(['expense', 'income']),
  occurred_on: z.string(),
});

export async function createTransaction(input: z.infer<typeof schema>) {
  const parse = schema.safeParse(input);
  if (!parse.success) return { ok: false, error: 'valor inválido' };

  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'não autenticado' };

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...parse.data,
      profile_id: user.id,
      household_id: (await supabase.from('profiles').select('household_id').eq('id', user.id).single()).data!.household_id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, transaction: data };
}
```

Roda `npm test` → green nos dois cenários.

Depois cria `src/app/(app)/lancar/page.tsx` com o form mínimo. Roda E2E → green.

### Passo 5 — Refactor

Olha o código e percebe: a derivação do `household_id` é repetitiva, vai aparecer em toda action. Extrai:

`src/lib/auth/current-household.ts`:

```ts
export async function currentHouseholdId(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('não autenticado');
  const { data } = await supabase.from('profiles').select('household_id').eq('id', user.id).single();
  if (!data) throw new Error('profile não encontrado');
  return data.household_id;
}
```

`src/lib/auth/current-household.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { currentHouseholdId } from './current-household';
import { getTestClient, seedHousehold, authAs } from '@/tests/helpers';

describe('currentHouseholdId', () => {
  beforeEach(resetTestDb);

  it('retorna o household do usuário autenticado', async () => {
    const { profileId, householdId } = await seedHousehold();
    await authAs(profileId);
    const result = await currentHouseholdId(getTestClient());
    expect(result).toBe(householdId);
  });

  it('throw quando não autenticado', async () => {
    await expect(currentHouseholdId(getTestClient())).rejects.toThrow(/autenticado/);
  });
});
```

Roda tudo → ainda verde. Commit:

```
feat(transactions): lançamento rápido de despesa

- Server Action createTransaction com validação Zod
- Página /lancar mobile-first
- helper currentHouseholdId extraído
- E2E + 3 integração + 2 unit verdes

Closes #<issue>
```

### Passo 6 — Code review

Invoca `engineering:code-review` apontando pro diff. Aplica os feedbacks (provavelmente: trate erro de RLS explicitamente, mova magic strings pra constants, etc).

---

## Regras anti-burlar

- **Não escreva implementação antes do teste.** Se você se pegar codando "porque já sei como vai ficar", para, deleta, escreve o teste primeiro.
- **Teste a falha primeiro.** Comece com red. Se o teste passa de primeira, o teste tá errado.
- **Refactor só com tudo verde.** Quando vai refatorar, garante que tá tudo passando. Refatora um bloco, roda, refatora outro, roda. Não acumule mudança não-testada.
- **Coverage não é meta, é piso.** 80% global é o mínimo pra mergear. Subir além disso só se trouxer confiança real — não force coverage por números.
