import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import type { Account, Movement } from '@core/state';
import { todayIso } from '@core/utils/dates';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { AccountsTabComponent } from './accounts-tab';

const cuenta = (id: string, type: Account['type'], opening: number): Account => ({
  id,
  name: `Cuenta ${id}`,
  type,
  currency: 'COP',
  openingBalance: opening,
});

const gasto = (id: string, accountId: string, category: string, amount: number, date: string): Movement => ({
  id,
  date,
  description: id,
  accountId,
  category,
  kind: 'expense',
  amount: -amount,
  status: 'confirmed',
});

function montar(cuentas: Account[], movimientos: (hoy: string) => Movement[] = () => []) {
  const montado = pruebaRender(AccountsTabComponent, {
    session: sesionDe().conCapacidad(P.cuentas.ver, P.movimientos.ver),
    data: datosDe({ accounts: cuentas, movements: movimientos(todayIso()) }),
    providers: [provideRouter([]) as unknown as Provider],
  });
  montado.cambios();
  return montado;
}

const series = (opcion: unknown) => (opcion as { series: { type: string; data: unknown[] }[] }).series;

describe('Cuentas, gráfica de saldos', () => {
  it('no incluye tarjetas, ordena de mayor a menor saldo y muestra a lo sumo ocho', () => {
    const cuentas = [
      ...Array.from({ length: 10 }, (_, indice) => cuenta(`c${indice}`, 'savings', (indice + 1) * 1000)),
      cuenta('visa', 'credit', 0),
    ];
    const { component } = montar(cuentas);

    const opcion = component.balancesOption() as {
      xAxis?: { data?: string[] };
      yAxis?: { data?: string[] };
    };
    const nombres = opcion.xAxis?.data ?? opcion.yAxis?.data ?? [];
    expect(nombres).toHaveLength(8);
    expect(nombres).not.toContain('Cuenta visa');
    expect(nombres).toContain('Cuenta c9');
    expect(nombres).not.toContain('Cuenta c0');
  });

  it('con solo tarjetas no hay datos de saldo', () => {
    const { component } = montar([cuenta('visa', 'credit', 0)]);

    expect(component.cuentasConDatos()).toBe(false);
  });
});

describe('Cuentas, flujo de gasto', () => {
  it('sin gastos recientes dice que no hay datos', () => {
    const { component } = montar([cuenta('a', 'savings', 1000)]);

    expect(component.flujoConDatos()).toBe(false);
  });

  it('con gastos del último mes dibuja un sankey de cuenta a categoría', () => {
    const { component } = montar([cuenta('a', 'savings', 500000), cuenta('b', 'cash', 100000)], (hoy) => [
      gasto('g1', 'a', 'Mercado', 80000, hoy),
      gasto('g2', 'a', 'Transporte', 20000, hoy),
      gasto('g3', 'b', 'Mercado', 10000, hoy),
    ]);

    expect(component.flujoConDatos()).toBe(true);
    const sankey = series(component.flujoOption()).find((serie) => serie.type === 'sankey') as
      { links: { source: string; target: string; value: number }[] } | undefined;
    expect(sankey).toBeDefined();
    const valores = sankey!.links.map((enlace) => enlace.value).sort((a, b) => a - b);
    expect(valores).toEqual([10000, 20000, 80000]);
  });

  it('la vista de deuda no mezcla el gasto de las cuentas', () => {
    const { component } = montar([cuenta('a', 'savings', 500000)], (hoy) => [gasto('g1', 'a', 'Mercado', 80000, hoy)]);

    component.elegirVistaDeFlujo('debt');

    expect(component.vistaDeFlujo()).toBe('debt');
    expect(component.flujoConDatos()).toBe(false);
  });
});
