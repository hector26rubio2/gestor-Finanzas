import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Account, Movement } from '@core/state';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { DashboardComponent } from './dashboard';

const cuentas: Account[] = [
  { id: 'banco', name: 'Banco', type: 'checking', currency: 'COP', openingBalance: 0 },
  { id: 'efectivo', name: 'Efectivo', type: 'cash', currency: 'COP', openingBalance: 0 },
];

const gasto = (id: string, date: string, categoria: string, monto: number): Movement =>
  ({
    id,
    date,
    description: id,
    accountId: 'banco',
    category: categoria,
    kind: 'expense',
    effect: 'expense',
    amount: -monto,
    status: 'confirmed',
  }) as Movement;

const MOVIMIENTOS: Movement[] = [
  gasto('m1', '2026-08-15', 'Mercado', 100_000),
  gasto('m2', '2026-08-06', 'Mercado', 30_000),
  gasto('o1', '2026-08-14', 'Ocio', 50_000),
];

function montar(permisos: string[] = [P.dashboard.ver, P.dashboard.widget.crear, P.dashboard.widget.deshabilitar]) {
  const montado = pruebaRender(DashboardComponent, {
    session: sesionDe().conCapacidad(...permisos),
    data: datosDe({ accounts: cuentas, movements: MOVIMIENTOS }),
    providers: [provideRouter([]) as unknown as Provider],
  });
  montado.component.periodo.anchor.set('2026-08-15');
  montado.cambios();
  return { componente: montado.component, store: montado.store };
}

function crear(componente: DashboardComponent, etiqueta: string, formula: string, dimension: string, valor: string) {
  componente.newKpiLabel = etiqueta;
  componente.newKpiFormula = formula as never;
  componente.newKpiDimension.set(dimension as never);
  componente.newKpiFilterValue = valor;
  componente.createKpi(new Event('submit'));
}

const dig = (texto: string) => texto.replace(/\D/g, '');

describe('Dashboard: KPI propio con fórmula', () => {
  beforeEach(() => localStorage.clear());

  it('un KPI de gasto filtrado por categoría se muestra con el valor calculado a mano', () => {
    const { componente } = montar();

    crear(componente, 'Mercado del mes', 'expense', 'category', 'Mercado');

    const item = componente.customKpiItems().find((k) => k.label === 'Mercado del mes');
    expect(item).toBeDefined();
    expect(dig(item!.value)).toBe('130000');
  });

  it('otra categoría da otro valor', () => {
    const { componente } = montar();

    crear(componente, 'Ocio del mes', 'expense', 'category', 'Ocio');

    expect(dig(componente.customKpiItems().find((k) => k.label === 'Ocio del mes')!.value)).toBe('50000');
  });

  it('el recuento filtrado cuenta solo los movimientos de esa categoría', () => {
    const { componente } = montar();

    crear(componente, 'Compras de mercado', 'count', 'category', 'Mercado');

    expect(componente.customKpiItems().find((k) => k.label === 'Compras de mercado')!.value).toContain('2');
  });

  it('al crearlo se avisa y el formulario se cierra y se vacía', () => {
    const { componente, store } = montar();
    componente.kpiCreatorOpen.set(true);

    crear(componente, 'Mercado', 'expense', 'category', 'Mercado');

    expect(store.toast.texto()).toContain('Mercado');
    expect(componente.kpiCreatorOpen()).toBe(false);
    expect(componente.newKpiLabel).toBe('');
  });

  it('sin nombre avisa y no crea nada', () => {
    const { componente, store } = montar();
    const antes = componente.customKpis().length;

    crear(componente, '   ', 'expense', 'category', 'Mercado');

    expect(componente.customKpis()).toHaveLength(antes);
    expect(store.toast.texto()).toBe('Escribe un nombre para el indicador');
  });

  it('con un filtro sin valor avisa que falta elegirlo', () => {
    const { componente, store } = montar();
    const antes = componente.customKpis().length;

    crear(componente, 'Algo', 'expense', 'category', '');

    expect(componente.customKpis()).toHaveLength(antes);
    expect(store.toast.texto()).toBe('Elige el valor sobre el que medir');
  });

  it('una fórmula que no admite filtro avisa y no se crea', () => {
    const { componente, store } = montar();
    const antes = componente.customKpis().length;

    crear(componente, 'Colchón', 'liquidityMonths', 'category', 'Mercado');

    expect(componente.customKpis()).toHaveLength(antes);
    expect(store.toast.texto()).toBe('Esa fórmula no se puede medir sobre un filtro');
  });

  it('repetir la misma fórmula y filtro avisa y no duplica', () => {
    const { componente, store } = montar();
    crear(componente, 'Mercado A', 'expense', 'category', 'Mercado');
    const antes = componente.customKpis().length;

    crear(componente, 'Mercado B', 'expense', 'category', 'Mercado');

    expect(componente.customKpis()).toHaveLength(antes);
    expect(store.toast.texto()).toBe('Ya tienes un indicador con esa fórmula');
  });

  it('sin permiso de crear no se crea nada', () => {
    const { componente } = montar([P.dashboard.ver]);
    const antes = componente.customKpis().length;

    crear(componente, 'Mercado', 'expense', 'category', 'Mercado');

    expect(componente.customKpis()).toHaveLength(antes);
  });

  it('quitar el KPI creado lo saca de la franja', () => {
    const { componente } = montar();
    crear(componente, 'Mercado', 'expense', 'category', 'Mercado');
    const creado = componente.customKpis().find((k) => k.label === 'Mercado')!;

    componente.removeKpi(creado.id);

    expect(componente.customKpis().some((k) => k.id === creado.id)).toBe(false);
  });
});
