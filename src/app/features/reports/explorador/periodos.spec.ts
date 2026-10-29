import { describe, expect, it } from 'vitest';
import { moverAncla } from './periodos';

describe('moverAncla', () => {
  it('retrocede un mes desde un día 31 sin salirse del mes anterior', () => {
    expect(moverAncla('2026-10-31', 'month', -1)).toBe('2026-09-30');
  });

  it('avanza un mes desde 31 de enero recortando a fin de febrero', () => {
    expect(moverAncla('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(moverAncla('2024-01-31', 'month', 1)).toBe('2024-02-29');
  });

  it('mueve por trimestre y año según el preset', () => {
    expect(moverAncla('2026-11-30', 'quarter', -1)).toBe('2026-08-30');
    expect(moverAncla('2024-02-29', 'year', 1)).toBe('2025-02-28');
  });

  it('un rango personalizado no mueve el ancla', () => {
    expect(moverAncla('2026-10-31', 'custom', 1)).toBe('2026-10-31');
  });
});
