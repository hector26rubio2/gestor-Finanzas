import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { PeopleTabComponent } from './people-tab';

const dinero = (amount: string, currency = 'COP') => ({ amount, currency });

const ANA = { id: 'ana', name: 'Ana', owed: 0, owing: 0 };
const BETO = { id: 'beto', name: 'Beto', owed: 0, owing: 0 };

function posiciones(conOtrasMonedas: boolean) {
  return [
    {
      counterparty: { id: 'ana', name: 'Ana' },
      receivable: dinero('500000'),
      ownDebt: dinero('0'),
      asOf: '2026-11-01',
      otherCurrencies: conOtrasMonedas
        ? [{ currency: 'USD', receivable: dinero('120.5', 'USD'), ownDebt: dinero('0', 'USD') }]
        : null,
    },
    {
      counterparty: { id: 'beto', name: 'Beto' },
      receivable: dinero('0'),
      ownDebt: dinero('200000'),
      asOf: '2026-11-01',
      otherCurrencies: conOtrasMonedas
        ? [{ currency: 'USD', receivable: dinero('30', 'USD'), ownDebt: dinero('10', 'USD') }]
        : null,
    },
  ];
}

async function montar(conOtrasMonedas: boolean) {
  const transport = new TransportFalso()
    .responder('GET /api/v1/people/debt-positions', { body: posiciones(conOtrasMonedas) })
    .responder('GET /api/v1/obligations', { body: [] });
  const montado = pruebaRender(PeopleTabComponent, {
    session: sesionDe().conCapacidad(P.personas.ver, P.personas.deudas.listar, P.personas.obligaciones.listar),
    data: datosDe({ people: [ANA, BETO] }),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.store.organization.set({ id: 'o1', name: 'Personal' });
  montado.store.remoteState.set('ready');
  montado.cambios();
  await montado.estable();
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return montado;
}

const aviso = (raiz: HTMLElement) => raiz.querySelector('[data-testid="aviso-otras-monedas"]');

describe('Personas, deudas en otra moneda', () => {
  it('avisa que no suman en los totales y muestra el total por moneda', async () => {
    const { fixture } = await montar(true);

    const texto = aviso(fixture.nativeElement as HTMLElement)?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('otra moneda');
    expect(texto).toContain('USD');
    expect(texto).toMatch(/150[,.]50/);
    expect(texto).toMatch(/10[,.]00/);
  });

  it('en la tabla la moneda de cada persona dice cuáles otras monedas tiene', async () => {
    const { fixture } = await montar(true);

    const filas = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')].map((fila) =>
      fila.textContent?.replace(/\s+/g, ' '),
    );
    expect(filas.some((fila) => fila?.includes('Ana') && fila.includes('COP + USD'))).toBe(true);
  });

  it('sin deudas en otras monedas no hay aviso', async () => {
    const { fixture } = await montar(false);

    expect(aviso(fixture.nativeElement as HTMLElement)).toBeNull();
  });
});
