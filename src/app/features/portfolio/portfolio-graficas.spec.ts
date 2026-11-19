import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import type { Investment } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { PortfolioTabComponent } from './portfolio-tab';

const inversion = (id: string, sobre: Partial<Investment> = {}): Investment =>
  ({
    id,
    name: `Inversión ${id}`,
    type: 'cdt',
    cost: 1_000_000,
    value: 1_200_000,
    institution: '',
    currency: 'COP',
    units: 0,
    risk: 'Medio',
    liquidity: 'Programada',
    netContributions: 0,
    ...sobre,
  }) as Investment;

function montar(inversiones: Investment[]) {
  const montado = pruebaRender(PortfolioTabComponent, {
    session: sesionDe().conCapacidad(P.patrimonio.ver),
    data: datosDe({ investments: inversiones }),
    providers: [provideRouter([]) as unknown as Provider],
  });
  montado.cambios();
  return montado.component;
}

type Opcion = {
  yAxis?: { data?: string[] };
  xAxis?: { data?: string[] };
  series?: { name?: string; type?: string; data: (number | { value: number; name?: string })[] }[];
};

const nombres = (opcion: unknown) => {
  const o = opcion as Opcion;
  return o.yAxis?.data ?? o.xAxis?.data ?? [];
};

describe('Patrimonio, gráficas frente a las inversiones reales', () => {
  it('el costo contra valor ordena de mayor a menor valor y muestra a lo sumo ocho', () => {
    const inversiones = Array.from({ length: 10 }, (_, i) => inversion(`i${i}`, { value: (i + 1) * 100_000 }));
    const componente = montar(inversiones);

    const lista = nombres(componente.costValueOption());
    expect(lista).toHaveLength(8);
    expect(lista).toContain('Inversión i9');
    expect(lista).not.toContain('Inversión i0');
  });

  it('el costo contra valor no mezcla pesos con dólares', () => {
    const componente = montar([
      inversion('cop', { value: 2_000_000 }),
      inversion('usd', { currency: 'USD', cost: 1000, value: 1500 }),
    ]);

    expect(nombres(componente.costValueOption())).toEqual(['Inversión cop']);
  });

  it('la distribución por tipo suma solo la moneda base y agrupa por tipo', () => {
    const componente = montar([
      inversion('a', { type: 'cdt', value: 500_000 }),
      inversion('b', { type: 'cdt', value: 300_000 }),
      inversion('c', { type: 'acciones', value: 200_000 }),
      inversion('usd', { type: 'etf', currency: 'USD', value: 9_999 }),
    ]);

    const serie = (componente.distributionOption() as Opcion).series?.[0];
    const datos = (serie?.data ?? []) as { name: string; value: number }[];
    expect(datos.map((d) => [d.name, d.value]).sort()).toEqual([
      ['acciones', 200_000],
      ['cdt', 800_000],
    ]);
  });

  it('sin inversiones no hay datos que graficar', () => {
    const componente = montar([]);

    expect(componente.hayInversiones()).toBe(false);
    expect(componente.hasInvestments()).toBe(false);
  });
});
