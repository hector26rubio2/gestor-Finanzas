import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { PeopleTabComponent } from './people-tab';

const dinero = (amount: string) => ({ amount, currency: 'COP' });

function obligacion(id: string, status: number, pendiente: string) {
  return {
    id,
    counterparty: { id: 'ana', name: 'Ana' },
    direction: 2,
    currency: 'COP',
    openedOn: '2026-08-15',
    dueOn: '2027-02-15',
    description: `Deuda ${id}`,
    status,
    totalOutstanding: dinero(pendiente),
    interestPolicies: [],
    entries: [
      { type: 1, date: '2026-08-15', principalDelta: dinero('300000') },
      ...(id === 'abierta'
        ? [{ type: 4, date: '2026-09-15', principalDelta: dinero('-50000'), note: 'Cuota de septiembre' }]
        : []),
    ],
    terms: null,
  };
}

async function montar(capacidades: string[]) {
  const transport = new TransportFalso()
    .responder('GET /api/v1/people/debt-positions', {
      body: [
        {
          counterparty: { id: 'ana', name: 'Ana' },
          receivable: dinero('0'),
          ownDebt: dinero('200000'),
          asOf: '2026-11-01',
        },
      ],
    })
    .responder('GET /api/v1/obligations', {
      body: [obligacion('abierta', 1, '200000'), obligacion('saldada', 2, '0')],
    });
  const montado = pruebaRender(PeopleTabComponent, {
    session: sesionDe().conCapacidad(
      P.personas.ver,
      P.personas.deudas.listar,
      P.personas.obligaciones.listar,
      ...capacidades,
    ),
    data: datosDe({ people: [{ id: 'ana', name: 'Ana', owed: 0, owing: 0 }] }),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.store.organization.set({ id: 'o1', name: 'Personal' });
  montado.store.remoteState.set('ready');
  for (let i = 0; i < 3; i++) {
    montado.cambios();
    await montado.estable();
  }
  const raiz = montado.fixture.nativeElement as HTMLElement;
  [...raiz.querySelectorAll('button')].find((b) => b.textContent?.includes('Ver deudas'))?.click();
  montado.cambios();
  return { ...montado, raiz };
}

const botones = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLButtonElement>('[data-testid="abonar-deuda"]')];

describe('Personas, abono a una deuda', () => {
  it('cada deuda abierta ofrece abonar; la saldada no', async () => {
    const { raiz } = await montar([P.movimientos.pagos.crear]);

    expect(botones(raiz)).toHaveLength(1);
  });

  it('al pulsar abonar abre el formulario de abono de esa deuda', async () => {
    const { raiz, store } = await montar([P.movimientos.pagos.crear]);

    botones(raiz)[0].click();

    expect(store.form()).toMatchObject({ kind: 'debt-payment', targetId: 'abierta' });
  });

  it('sin permiso de pagos ni de crear movimientos no hay botón', async () => {
    const { raiz } = await montar([]);

    expect(botones(raiz)).toHaveLength(0);
  });

  it('muestra en el historial cada abono con su motivo', async () => {
    const { raiz } = await montar([P.movimientos.pagos.crear]);

    const historial = raiz.querySelector('[data-testid="historial-abonos"]')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(historial).toContain('2026-09-15');
    expect(historial).toMatch(/50[.,]000/);
    expect(historial).toContain('Cuota de septiembre');
  });
});
