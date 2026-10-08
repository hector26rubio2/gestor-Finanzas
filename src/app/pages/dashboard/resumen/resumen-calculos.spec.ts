import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { gastoInusual, tramosSemanales, variacionPorcentual } from './resumen-calculos';

const gasto = (id: string, monto: number, cambios: Partial<Movement> = {}): Movement => ({
  id,
  date: '2026-10-05',
  description: id,
  accountId: 'a',
  category: 'c',
  kind: 'expense',
  effect: 'expense',
  amount: -monto,
  status: 'confirmed',
  ...cambios,
});

describe('cálculos del resumen', () => {
  it('agrupa por semanas del mes y acumula el saldo', () => {
    const tramos = tramosSemanales(
      [
        { key: '2026-10-02', label: '', income: 1000, expense: 200 },
        { key: '2026-10-09', label: '', income: 0, expense: 300 },
        { key: '2026-10-30', label: '', income: 100, expense: 50 },
      ],
      (inicio, fin) => `${inicio}-${fin}`,
    );
    expect(tramos.map((tramo) => tramo.etiqueta)).toEqual(['1-2', '8-9', '22-30']);
    expect(tramos.map((tramo) => tramo.saldo)).toEqual([800, 500, 550]);
  });

  it('señala un gasto que multiplica la mediana e ignora los recurrentes', () => {
    const normales = ['a', 'b', 'c', 'd'].map((id) => gasto(id, 20000));
    expect(gastoInusual([...normales, gasto('tv', 400000)])?.movimiento.id).toBe('tv');
    expect(gastoInusual([...normales, gasto('arriendo', 400000, { recurring: true })])).toBeNull();
    expect(gastoInusual(normales)).toBeNull();
  });

  it('calcula la variación solo con una base distinta de cero', () => {
    expect(variacionPorcentual(110, 100)).toBeCloseTo(10);
    expect(variacionPorcentual(110, 0)).toBeNull();
    expect(variacionPorcentual(110, null)).toBeNull();
  });
});
