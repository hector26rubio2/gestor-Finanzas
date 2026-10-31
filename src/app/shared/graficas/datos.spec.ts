import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { agregar, cruzar, type ContextoDeDatos } from './datos';
import type { Granularidad } from './modelo';

function contexto(granularidad: Granularidad, rango?: { desde: string; hasta: string }): ContextoDeDatos {
  return {
    locale: 'es-CO',
    granularidad,
    rango,
    t: (clave) => clave,
    nombreDeCuenta: () => 'cuenta',
    tipoDeCuenta: () => 'tipo',
    tipoDeMovimiento: () => 'tipo',
  };
}

const gasto = (date: string, amount: number) =>
  ({ date, amount, kind: 'expense', category: 'x', accountId: 'a' }) as Movement;

describe('agregar con rango', () => {
  const movs = [gasto('2026-01-10', -100), gasto('2026-03-05', -50)];
  const rango = { desde: '2026-01-01', hasta: '2026-04-30' };

  it('incluye los meses sin movimientos con valor 0', () => {
    const filas = agregar(movs, 'date', 'expense', contexto('month', rango));
    expect(filas.map((f) => f.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(filas.map((f) => f.value)).toEqual([100, 0, 50, 0]);
  });

  it('sin rango solo devuelve los meses con movimientos', () => {
    expect(agregar(movs, 'date', 'expense', contexto('month')).map((f) => f.key)).toEqual(['2026-01', '2026-03']);
  });

  it('completa tambien los dias', () => {
    const filas = agregar(
      [gasto('2026-01-01', -1), gasto('2026-01-04', -1)],
      'date',
      'expense',
      contexto('day', {
        desde: '2026-01-01',
        hasta: '2026-01-05',
      }),
    );
    expect(filas.map((f) => f.value)).toEqual([1, 0, 0, 1, 0]);
  });

  it('completa trimestres y anios', () => {
    const trimestres = agregar(
      [gasto('2026-02-01', -1)],
      'date',
      'expense',
      contexto('quarter', { desde: '2026-01-01', hasta: '2026-12-31' }),
    );
    expect(trimestres.map((f) => f.key)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
    const anios = agregar(
      [gasto('2025-02-01', -1)],
      'date',
      'expense',
      contexto('year', { desde: '2025-01-01', hasta: '2027-06-01' }),
    );
    expect(anios.map((f) => f.key)).toEqual(['2025', '2026', '2027']);
  });

  it('completa semanas sin repetir claves', () => {
    const filas = agregar(
      [gasto('2026-01-05', -1)],
      'date',
      'expense',
      contexto('week', { desde: '2026-01-05', hasta: '2026-01-25' }),
    );
    expect(filas.map((f) => f.key)).toEqual(['2026-W02', '2026-W03', '2026-W04']);
  });

  it('no completa dimensiones que no son fecha', () => {
    expect(agregar(movs, 'category', 'expense', contexto('month', rango))).toHaveLength(1);
  });
});

describe('cruzar con rango', () => {
  it('los ejes de fecha incluyen los meses vacios', () => {
    const movs = [gasto('2026-01-10', -100), gasto('2026-03-05', -50)];
    const cruce = cruzar(
      movs,
      'date',
      'category',
      'expense',
      contexto('month', { desde: '2026-01-01', hasta: '2026-04-30' }),
    );
    expect(cruce.categories).toHaveLength(4);
    expect(cruce.series[0].data).toEqual([100, 0, 50, 0]);
  });
});
