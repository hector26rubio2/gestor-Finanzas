import { Router, provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { esCuentaValida, esPeriodoValido, periodoDeLaEscala } from './filtros-por-url';
import { MovementsTabComponent } from './movements-tab';

describe('periodo en la URL de Movimientos', () => {
  it.each(['2026', '2026-11', '2026-01', '2026-12'])('%s es un periodo válido', (valor) => {
    expect(esPeriodoValido(valor)).toBe(true);
  });

  it.each(['', 'all', '26', '2026-13', '2026-00', '2026-1', '2026-11-05', 'noviembre'])(
    '«%s» no es un periodo válido',
    (valor) => {
      expect(esPeriodoValido(valor)).toBe(false);
    },
  );
});

describe('cuenta en la URL de Movimientos', () => {
  it('acepta identificadores y rechaza texto con caracteres raros', () => {
    expect(esCuentaValida('30000000-0000-0000-0000-000000000001')).toBe(true);
    expect(esCuentaValida('visa')).toBe(true);
    expect(esCuentaValida('')).toBe(false);
    expect(esCuentaValida('a b')).toBe(false);
    expect(esCuentaValida('<script>')).toBe(false);
  });
});

describe('periodo de Movimientos a partir de la escala del tablero', () => {
  it('mes y año se conservan; semana y día caen en el mes de su inicio', () => {
    expect(periodoDeLaEscala('month', '2026-11-01')).toBe('2026-11');
    expect(periodoDeLaEscala('year', '2026-01-01')).toBe('2026');
    expect(periodoDeLaEscala('week', '2026-11-09')).toBe('2026-11');
    expect(periodoDeLaEscala('day', '2026-11-12')).toBe('2026-11');
  });
});

describe('Movimientos abierto desde un enlace', () => {
  async function montarDesde(url: string) {
    const transport = new TransportFalso().responder(/^POST \/api\/v1\/movements\/search/, {
      body: { items: [], hasNext: false, size: 25, total: 0 },
    });
    const montado = pruebaRender(MovementsTabComponent, {
      session: sesionDe().conCapacidad(P.movimientos.ver),
      data: datosDe(),
      providers: [provideRouter([{ path: '**', children: [] }]) as unknown as Provider],
      transport,
    });
    montado.cambios();
    await montado.estable();
    await TestBed.inject(Router).navigateByUrl(url);
    montado.cambios();
    await montado.estable();
    montado.cambios();
    await montado.estable();
    return { ...montado, transport };
  }

  it('aplica el periodo y la cuenta que trae el enlace', async () => {
    const { store } = await montarDesde('/movements?periodo=2026-10&cuenta=cuenta-9');

    expect(store.period()).toBe('2026-10');
    expect(store.accountFilter()).toBe('cuenta-9');
  });

  it('pide al servidor el listado con ese periodo y esa cuenta', async () => {
    const { transport } = await montarDesde('/movements?periodo=2026-10&cuenta=cuenta-9');

    const cuerpos = transport.peticiones
      .filter((p) => p.path === '/api/v1/movements/search')
      .map((p) => JSON.stringify(p.body));
    const delListado = cuerpos.filter((cuerpo) => cuerpo.includes('cuenta-9'));
    expect(delListado.length).toBeGreaterThan(0);
    expect(delListado.at(-1)).toContain('2026-10');
  });

  it('no repite la carga cuando el cambio de periodo viene del propio selector', async () => {
    const { transport, component, cambios, estable } = await montarDesde('/movements');
    const antes = transport.peticiones.filter((p) =>
      JSON.stringify(p.body ?? '').includes('"period":"2026-09"'),
    ).length;

    component.setPeriodYear('2026');
    component.setPeriodMonth('09');
    cambios();
    await estable();
    cambios();
    await estable();

    const despues = transport.peticiones.filter((p) => JSON.stringify(p.body ?? '').includes('2026-09'));
    expect(antes).toBe(0);
    const listados = despues.filter((p) => !JSON.stringify(p.body).includes('"range"'));
    expect(listados.length).toBeLessThanOrEqual(2);
  });

  it('quitar la cuenta de la URL vuelve a mostrar todas las cuentas', async () => {
    const { store, cambios, estable } = await montarDesde('/movements?cuenta=cuenta-9');
    expect(store.accountFilter()).toBe('cuenta-9');

    await TestBed.inject(Router).navigateByUrl('/movements');
    cambios();
    await estable();
    cambios();

    expect(store.accountFilter()).toBe('all');
  });

  it('al salir de Movimientos la cuenta no se queda puesta para la próxima visita', async () => {
    const { store, fixture } = await montarDesde('/movements?cuenta=cuenta-9');
    expect(store.accountFilter()).toBe('cuenta-9');

    fixture.destroy();

    expect(store.accountFilter()).toBe('all');
  });

  it('ignora un periodo inválido y deja el listado completo', async () => {
    const { store } = await montarDesde('/movements?periodo=cualquier-cosa');

    expect(store.period()).toBe('all');
  });
});
