import { describe, expect, it } from 'vitest';
import { gastoPromedioMensual, mayorSubida, mesesCerrados } from './meses-cerrados';

const periodos = ['2026-08', '2026-09', '2026-10'];

describe('mesesCerrados', () => {
  it('excluye el mes en curso', () => {
    expect(mesesCerrados(periodos, '2026-10-05')).toEqual(['2026-08', '2026-09']);
  });
});

describe('mayorSubida', () => {
  const gasto = (date: string, category: string, monto: number) => ({ date, category, monto });

  it('compara el ultimo mes cerrado contra el anterior y no el mes parcial', () => {
    const gastos = [
      gasto('2026-08-10', 'Mercado', 100),
      gasto('2026-09-10', 'Mercado', 150),
      gasto('2026-10-02', 'Mercado', 1000),
    ];
    expect(mayorSubida(gastos, mesesCerrados(periodos, '2026-10-05'))).toEqual({ nombre: 'Mercado', porcentaje: 50 });
  });

  it('sin dos meses cerrados no hay comparacion', () => {
    expect(mayorSubida([], mesesCerrados(['2026-09', '2026-10'], '2026-10-05'))).toBeNull();
  });
});

describe('gastoPromedioMensual', () => {
  it('divide solo entre los meses cerrados', () => {
    const gastos = [
      { date: '2026-08-10', monto: 100 },
      { date: '2026-09-10', monto: 300 },
      { date: '2026-10-02', monto: 50 },
    ];
    expect(gastoPromedioMensual(gastos, mesesCerrados(periodos, '2026-10-05'))).toBe(200);
  });

  it('sin meses cerrados devuelve 0', () => {
    expect(gastoPromedioMensual([{ date: '2026-10-02', monto: 50 }], [])).toBe(0);
  });
});
