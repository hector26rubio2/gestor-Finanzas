import { describe, expect, it } from 'vitest';
import type { ApiBudget, ApiCategory } from '@core/api';
import { estadoDelPresupuesto, filasDePresupuesto, limiteDeTexto, montoDeApi } from './presupuestos';

const categoria = (id: string, name: string, cambios: Partial<ApiCategory> = {}): ApiCategory => ({
  id,
  name,
  type: 2,
  color: '#123456',
  icon: 'tag',
  parent: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  ...cambios,
});

const presupuesto = (categoryId: string, amount: string, currency = 'COP'): ApiBudget => ({
  id: `p-${categoryId}`,
  category: { id: categoryId, name: categoryId },
  monthlyLimit: { amount, currency },
  updatedAt: '2026-10-01T00:00:00Z',
});

describe('presupuestos', () => {
  it('clasifica el uso del presupuesto', () => {
    expect(estadoDelPresupuesto(500, 1000)).toEqual({ porcentaje: 50, nivel: 'ok', diferencia: 500 });
    expect(estadoDelPresupuesto(900, 1000).nivel).toBe('alerta');
    expect(estadoDelPresupuesto(1120, 1000)).toEqual({ porcentaje: 112, nivel: 'excedido', diferencia: -120 });
    expect(estadoDelPresupuesto(10, 0).porcentaje).toBe(0);
  });

  it('arma una fila por categoría de gasto activa con su avance', () => {
    const filas = filasDePresupuesto({
      categorias: [
        categoria('c1', 'Mercado'),
        categoria('c2', 'Ocio'),
        categoria('c3', 'Sueldo', { type: 1 }),
        categoria('c4', 'Vieja', { isActive: false }),
      ],
      presupuestos: [presupuesto('c1', '1000')],
      gastoPorCategoria: new Map([
        ['Mercado', 900],
        ['Ocio', 40],
      ]),
      monedaBase: 'cop',
    });

    expect(filas.map((fila) => fila.categoria.name)).toEqual(['Mercado', 'Ocio']);
    expect(filas[0].limite).toBe(1000);
    expect(filas[0].estado?.nivel).toBe('alerta');
    expect(filas[1]).toMatchObject({ limite: null, gastado: 40, estado: null });
  });

  it('ordena primero los más gastados y deja al final las categorías sin límite', () => {
    const filas = filasDePresupuesto({
      categorias: [categoria('a', 'A'), categoria('b', 'B'), categoria('c', 'C')],
      presupuestos: [presupuesto('a', '100'), presupuesto('c', '100')],
      gastoPorCategoria: new Map([
        ['A', 20],
        ['C', 150],
        ['B', 999],
      ]),
      monedaBase: 'COP',
    });

    expect(filas.map((fila) => fila.categoria.name)).toEqual(['C', 'A', 'B']);
  });

  it('marca el límite en otra moneda y no calcula avance', () => {
    const [fila] = filasDePresupuesto({
      categorias: [categoria('a', 'A')],
      presupuestos: [presupuesto('a', '100', 'USD')],
      gastoPorCategoria: new Map([['A', 50]]),
      monedaBase: 'COP',
    });

    expect(fila).toMatchObject({ limite: null, estado: null, monedaAjena: 'USD' });
  });

  it('valida el texto del límite', () => {
    expect(limiteDeTexto('250000', 'COP')).toBe(250000);
    expect(limiteDeTexto(' 1500,5 ', 'USD')).toBe(1500.5);
    expect(limiteDeTexto('0', 'COP')).toBeNull();
    expect(limiteDeTexto('', 'COP')).toBeNull();
    expect(limiteDeTexto('-5', 'COP')).toBeNull();
    expect(limiteDeTexto('12abc', 'COP')).toBeNull();
  });

  it('envía el monto con los decimales de la moneda', () => {
    expect(montoDeApi(1500.5, 'USD')).toBe('1500.50');
    expect(montoDeApi(250000, 'COP')).toBe('250000');
  });
});
