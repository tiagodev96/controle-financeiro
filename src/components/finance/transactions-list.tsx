'use client';

import { useState } from 'react';
import { TxnRow } from './txn-row';
import { Num } from './num';
import { sumDayTotals } from '@/lib/finance/day-totals';
import { TxnRowMenu } from './txn-row-menu';
import { TransferRow } from './transfer-row';
import { EditTransactionDialog } from './edit-transaction-dialog';
import type { Currency } from './num';

type Direction = 'expense' | 'income';
type Status = 'pending' | 'paid';

export type Transaction = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  direction: Direction;
  status: Status;
  occurred_on: string;
  paid_on: string | null;
  category_id: string | null;
  account_id: string;
  source_recurring_rule_id: string | null;
  source_installment_plan_id: string | null;
  installment_number: number | null;
  credit_card_id?: string | null;
  purchased_on?: string | null;
  categories: { name: string } | null;
  installment_plans: { total_installments: number } | null;
  credit_cards?: { name: string } | null;
  /** Linha virtual de recorrente em mês futuro (não existe no banco). Read-only. */
  previsto?: boolean;
  /** Linha de cobertura (conversão/transferência entre contas). Read-only. */
  transfer?: {
    fromCents: number;
    fromCurrency: Currency;
    toCents: number;
    toCurrency: Currency;
  } | null;
};

type CategoryFull = {
  id: string;
  name: string;
  icon: string | null;
  kind: 'expense' | 'income';
  is_archived: boolean;
};

type AccountFull = {
  id: string;
  name: string;
  currency: Currency;
  is_archived: boolean;
};

type Props = {
  groups: { label: string; rows: Transaction[] }[];
  categories: CategoryFull[];
  accounts: AccountFull[];
};

function txnSource(t: Transaction):
  | { kind: 'recurring' }
  | { kind: 'installment'; number: number; total: number }
  | null {
  if (t.source_installment_plan_id && t.installment_number && t.installment_plans) {
    return {
      kind: 'installment',
      number: t.installment_number,
      total: t.installment_plans.total_installments,
    };
  }
  if (t.source_recurring_rule_id) return { kind: 'recurring' };
  return null;
}

export function TransactionsList({ groups, categories, accounts }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <>
      <section className="space-y-4">
        {groups.map(({ label, rows }) => {
          const totals = sumDayTotals(rows);
          return (
          <div key={label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <p className="eyebrow">{label}</p>
              <p className="flex items-baseline gap-2.5">
                {totals.map((t) => (
                  <span key={t.currency} className="flex items-baseline gap-1.5">
                    {t.expenseCents > 0 && (
                      <Num
                        cents={-t.expenseCents}
                        currency={t.currency}
                        className="text-[11px] font-semibold text-money-negative"
                      />
                    )}
                    {t.incomeCents > 0 && (
                      <Num
                        cents={t.incomeCents}
                        currency={t.currency}
                        className="text-[11px] font-semibold text-money-positive"
                      />
                    )}
                  </span>
                ))}
              </p>
            </div>
            <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
              {rows.map((t) =>
                t.transfer ? (
                  <div key={t.id} data-testid={`transfer-row-${t.id}`}>
                    <TransferRow
                      fromCents={t.transfer.fromCents}
                      fromCurrency={t.transfer.fromCurrency}
                      toCents={t.transfer.toCents}
                      toCurrency={t.transfer.toCurrency}
                    />
                  </div>
                ) : t.previsto ? (
                  <div key={t.id} data-testid="txn-row-previsto">
                    <TxnRow
                      description={t.description}
                      category={t.categories?.name ?? '—'}
                      amountCents={t.amount_cents}
                      currency={t.currency}
                      direction={t.direction}
                      previsto
                    />
                  </div>
                ) : (
                  <div key={t.id} data-testid={`txn-row-${t.id}`}>
                    <TxnRow
                      description={t.description}
                      category={t.categories?.name ?? '—'}
                      amountCents={t.amount_cents}
                      currency={t.currency}
                      direction={t.direction}
                      status={t.status}
                      source={txnSource(t)}
                      card={
                        t.credit_card_id
                          ? {
                              name: t.credit_cards?.name ?? 'Cartão',
                              purchasedOn: t.purchased_on ?? null,
                            }
                          : null
                      }
                      action={
                        <TxnRowMenu
                          transactionId={t.id}
                          showMarkPaid={t.status === 'pending'}
                          onEdit={() => setEditing(t)}
                        />
                      }
                    />
                  </div>
                ),
              )}
            </div>
          </div>
          );
        })}
      </section>

      <EditTransactionDialog
        transaction={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        categories={categories}
        accounts={accounts}
      />
    </>
  );
}
