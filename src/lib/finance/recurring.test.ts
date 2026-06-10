import { describe, it, expect } from 'vitest';
import { ruleAppliesToMonth } from './recurring';

describe('ruleAppliesToMonth', () => {
  it('U-RR1 — mensal aplica em qualquer mês', () => {
    expect(ruleAppliesToMonth({ frequency: 'monthly', active_from: '2026-03-01' }, '2026-06')).toBe(
      true,
    );
    expect(ruleAppliesToMonth({ frequency: 'monthly', active_from: null }, '2026-06')).toBe(true);
  });

  it('U-RR2 — anual aplica só no mês-aniversário de active_from, em qualquer ano', () => {
    const rule = { frequency: 'yearly', active_from: '2025-09-15' };
    expect(ruleAppliesToMonth(rule, '2026-09')).toBe(true);
    expect(ruleAppliesToMonth(rule, '2027-09')).toBe(true);
    expect(ruleAppliesToMonth(rule, '2026-06')).toBe(false);
    expect(ruleAppliesToMonth(rule, '2026-10')).toBe(false);
  });

  it('U-RR3 — anual sem active_from nunca aplica (defensivo; coluna é not null no banco)', () => {
    expect(ruleAppliesToMonth({ frequency: 'yearly', active_from: null }, '2026-06')).toBe(false);
  });
});
