export type MonthFlow = {
  incomeCents: number;
  /** Despesas do mês (pagas + pendentes). */
  expenseCents: number;
  topCategories: { name: string; totalCents: number }[];
};

export type DeltaDirection = 'good' | 'bad' | 'neutral';

export type Delta = {
  diffCents: number;
  /** Fração sobre a base anterior (0.1 = +10%). Null quando a base é pequena demais pra um percentual honesto. */
  pct: number | null;
  /** Semântica já resolvida: despesa menor é good, entrada maior é good. */
  direction: DeltaDirection;
};

export type CategoryComparison = {
  name: string;
  currentCents: number;
  previousCents: number;
  diffCents: number;
};

export type MonthComparison = {
  income: Delta;
  expense: Delta;
  /** Líquido do fluxo (entradas − despesas) de cada mês. */
  sobra: Delta;
  /** Top categorias do mês atual com o valor do mês anterior (0 se não existia). */
  categories: CategoryComparison[];
};

/** Base mínima pra percentual fazer sentido — abaixo disso, só delta absoluto. */
const MIN_PCT_BASE_CENTS = 100;

function delta(currentCents: number, previousCents: number, moreIsGood: boolean): Delta {
  const diffCents = currentCents - previousCents;
  const base = Math.abs(previousCents);
  const pct = base >= MIN_PCT_BASE_CENTS ? diffCents / base : null;
  const direction: DeltaDirection =
    diffCents === 0 ? 'neutral' : (diffCents > 0) === moreIsGood ? 'good' : 'bad';
  return { diffCents, pct, direction };
}

export function compareMonths(current: MonthFlow, previous: MonthFlow): MonthComparison {
  const previousByName = new Map(previous.topCategories.map((c) => [c.name, c.totalCents]));

  return {
    income: delta(current.incomeCents, previous.incomeCents, true),
    expense: delta(current.expenseCents, previous.expenseCents, false),
    sobra: delta(
      current.incomeCents - current.expenseCents,
      previous.incomeCents - previous.expenseCents,
      true,
    ),
    categories: current.topCategories.map((c) => {
      const previousCents = previousByName.get(c.name) ?? 0;
      return {
        name: c.name,
        currentCents: c.totalCents,
        previousCents,
        diffCents: c.totalCents - previousCents,
      };
    }),
  };
}
