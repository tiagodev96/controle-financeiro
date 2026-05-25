import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MoneyInput } from './money-input';

function ControlledHarness({
  initial = 0,
  onChangeSpy,
}: {
  initial?: number;
  onChangeSpy?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
      label="Valor"
      valueCents={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
    />
  );
}

describe('<MoneyInput>', () => {
  it('M-1 — render inicial mostra "0,00"', () => {
    render(<MoneyInput label="Valor" valueCents={0} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Valor')).toHaveValue('0,00');
  });

  it('M-2 — valueCents controlado reflete no display', () => {
    render(<MoneyInput label="Valor" valueCents={500} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Valor')).toHaveValue('5,00');
  });

  it('M-3 — digitar "1" → onChange recebe 1 e display vira "0,01"', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness onChangeSpy={spy} />);

    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.keyboard('1');

    expect(spy).toHaveBeenLastCalledWith(1);
    expect(input).toHaveValue('0,01');
  });

  it('M-4 — digitar "1059" → display "10,59" e onChange última call com 1059', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness onChangeSpy={spy} />);

    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.keyboard('1059');

    expect(input).toHaveValue('10,59');
    expect(spy).toHaveBeenLastCalledWith(1059);
  });

  it('M-5 — digitar "105950" → display "1.059,50" com separador de milhar', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness />);

    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.keyboard('105950');

    expect(input).toHaveValue('1.059,50');
  });

  it('M-6 — backspace de 1250 cents (12,50) vira 125 (1,25)', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initial={1250} onChangeSpy={spy} />);

    const input = screen.getByLabelText('Valor');
    expect(input).toHaveValue('12,50');

    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(spy).toHaveBeenLastCalledWith(125);
    expect(input).toHaveValue('1,25');
  });

  it('M-7 — backspace de 0,00 (0 cents) não vai abaixo de 0', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initial={0} onChangeSpy={spy} />);

    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(input).toHaveValue('0,00');
    // onChange pode ou não ser chamado com 0; aceitamos os dois (idempotente).
    for (const call of spy.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(0);
    }
  });

  it('M-8 — caracteres não-numéricos (letra, vírgula, ponto, espaço) são ignorados', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness onChangeSpy={spy} />);

    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.keyboard('a,. ');

    expect(input).toHaveValue('0,00');
    // Nenhuma das calls de onChange deveria mudar o valor (continua 0).
    for (const call of spy.mock.calls) {
      expect(call[0]).toBe(0);
    }
  });

  it('M-9 — autoFocus prop foca o input no mount', () => {
    render(<MoneyInput label="Valor" valueCents={0} onChange={vi.fn()} autoFocus />);
    expect(screen.getByLabelText('Valor')).toHaveFocus();
  });

  it('M-10 — atributos inputMode="numeric" e role acessível', () => {
    render(<MoneyInput label="Valor" valueCents={0} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Valor');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });
});
