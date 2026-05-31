import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TxnRow } from './txn-row';

describe('TxnRow', () => {
  it('previsto: mostra badge "Previsto" e omite o status pill', () => {
    render(
      <TxnRow
        description="Salário"
        category="Renda"
        amountCents={220000}
        currency="EUR"
        direction="income"
        status="pending"
        previsto
      />,
    );
    expect(screen.getByText(/previsto/i)).toBeInTheDocument();
    expect(screen.queryByText(/pendente/i)).not.toBeInTheDocument();
  });

  it('linha real: mostra status e não mostra badge "Previsto"', () => {
    render(
      <TxnRow
        description="Mercado"
        category="Mercado"
        amountCents={5000}
        currency="EUR"
        direction="expense"
        status="pending"
      />,
    );
    expect(screen.getByText(/pendente/i)).toBeInTheDocument();
    expect(screen.queryByText(/previsto/i)).not.toBeInTheDocument();
  });
});
