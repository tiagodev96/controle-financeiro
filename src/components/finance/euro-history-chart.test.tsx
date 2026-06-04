import { describe, it, expect } from 'vitest';
import { sliceByPeriod } from './euro-history-chart';

const SERIES = [
  { date: '2025-05-01', rate: 6.0 },
  { date: '2025-05-20', rate: 6.1 },
  { date: '2025-06-10', rate: 6.2 },
  { date: '2025-06-14', rate: 6.25 },
  { date: '2025-06-15', rate: 6.3 },
];

describe('sliceByPeriod', () => {
  it('1y (days null): retorna a série inteira', () => {
    expect(sliceByPeriod(SERIES, null)).toHaveLength(5);
  });

  it('7d: mantém só os pontos dentro de 7 dias do último', () => {
    const out = sliceByPeriod(SERIES, 7);
    expect(out.map((p) => p.date)).toEqual(['2025-06-10', '2025-06-14', '2025-06-15']);
  });

  it('30d: corta pelos últimos 30 dias do último ponto', () => {
    const out = sliceByPeriod(SERIES, 30);
    expect(out.map((p) => p.date)).toEqual(['2025-05-20', '2025-06-10', '2025-06-14', '2025-06-15']);
  });

  it('série vazia: retorna vazio', () => {
    expect(sliceByPeriod([], 7)).toEqual([]);
  });
});
