'use client';

import { useState } from 'react';
import { TxnRow } from './txn-row';
import { TxnRowMenu } from './txn-row-menu';
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
  categories: { name: string } | null;
};

type CategoryFull = {
  id: string;
  name: string;
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

export function TransactionsList({ groups, categories, accounts }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <>
      <section className="space-y-4">
        {groups.map(({ label, rows }) => (
          <div key={label} className="space-y-1.5">
            <p className="eyebrow px-1">{label}</p>
            <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
              {rows.map((t) => (
                <div key={t.id} data-testid={`txn-row-${t.id}`}>
                  <TxnRow
                    description={t.description}
                    category={t.categories?.name ?? '—'}
                    amountCents={t.amount_cents}
                    currency={t.currency}
                    direction={t.direction}
                    status={t.status}
                    action={
                      <TxnRowMenu
                        transactionId={t.id}
                        showMarkPaid={t.status === 'pending'}
                        onEdit={() => setEditing(t)}
                      />
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
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
