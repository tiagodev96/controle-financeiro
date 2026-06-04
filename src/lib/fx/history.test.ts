import { describe, it, expect } from 'vitest';
import { computeFetchRange } from './history';

describe('computeFetchRange', () => {
  const FROM = '2025-01-01';
  const TO = '2025-12-31';

  it('cache vazio: pede o intervalo inteiro', () => {
    expect(computeFetchRange([], FROM, TO)).toEqual({ start: FROM, end: TO });
  });

  it('cobertura completa (bordas dentro da tolerância): nada a buscar', () => {
    const dates = ['2025-01-03', '2025-06-15', '2025-12-29'];
    expect(computeFetchRange(dates, FROM, TO)).toBeNull();
  });

  it('gap só no início: busca de from até o primeiro cacheado', () => {
    const dates = ['2025-06-01', '2025-09-10', '2025-12-29'];
    expect(computeFetchRange(dates, FROM, TO)).toEqual({
      start: FROM,
      end: '2025-06-01',
    });
  });

  it('gap só no fim: busca do último cacheado até to', () => {
    const dates = ['2025-01-03', '2025-04-10', '2025-06-01'];
    expect(computeFetchRange(dates, FROM, TO)).toEqual({
      start: '2025-06-01',
      end: TO,
    });
  });

  it('gap nos dois lados: busca o intervalo inteiro', () => {
    const dates = ['2025-06-01', '2025-06-10'];
    expect(computeFetchRange(dates, FROM, TO)).toEqual({ start: FROM, end: TO });
  });

  it('gap de fim de semana fica dentro da tolerância (não busca)', () => {
    const dates = ['2025-01-02', '2025-12-26'];
    expect(computeFetchRange(dates, '2025-01-01', '2025-12-29')).toBeNull();
  });
});
