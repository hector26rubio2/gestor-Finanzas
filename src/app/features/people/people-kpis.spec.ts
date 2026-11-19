import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { todayIso } from '@core/utils/dates';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { PeopleTabComponent } from './people-tab';

const dinero = (amount: string) => ({ amount, currency: 'COP' });

const personas = [
  { id: 'ana', name: 'Ana', owed: 0, owing: 0 },
  { id: 'beto', name: 'Beto', owed: 0, owing: 0 },
  { id: 'banco', name: 'Banco Andino', owed: 0, owing: 0, kind: 'institution' as const },
];

const posiciones = [
  { counterparty: { id: 'ana', name: 'Ana' }, receivable: dinero('500000'), ownDebt: dinero('0'), asOf: '2026-11-01' },
  {
    counterparty: { id: 'beto', name: 'Beto' },
    receivable: dinero('150000'),
    ownDebt: dinero('40000'),
    asOf: '2026-11-01',
  },
  {
    counterparty: { id: 'banco', name: 'Banco Andino' },
    receivable: dinero('0'),
    ownDebt: dinero('2000000'),
    asOf: '2026-11-01',
  },
];

function hace(meses: number): string {
  const fecha = new Date(`${todayIso()}T00:00:00Z`);
  fecha.setUTCMonth(fecha.getUTCMonth() - meses);
  return fecha.toISOString().slice(0, 10);
}

const credito = (id: string, contraparte: { id: string; name: string }, mesesAtras: number, plazo: number) => ({
  id,
  counterparty: contraparte,
  direction: 2,
  currency: 'COP',
  openedOn: hace(mesesAtras),
  dueOn: null,
  description: `Crédito ${id}`,
  status: 1,
  totalOutstanding: dinero('1000000'),
  interestPolicies: [],
  entries: [{ type: 1, date: hace(mesesAtras), principalDelta: dinero('1200000') }],
  terms: { product: 3, monthlyRate: 0, termMonths: plazo, cardMode: null },
});

async function montar(obligaciones: unknown[]) {
  const transport = new TransportFalso()
    .responder('GET /api/v1/people/debt-positions', { body: posiciones })
    .responder('GET /api/v1/obligations', { body: obligaciones });
  const montado = pruebaRender(PeopleTabComponent, {
    session: sesionDe().conCapacidad(P.personas.ver, P.personas.deudas.listar, P.personas.obligaciones.listar),
    data: datosDe({ people: personas }),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.store.organization.set({ id: 'o1', name: 'Personal' });
  montado.store.remoteState.set('ready');
  for (let i = 0; i < 3; i++) {
    montado.cambios();
    await montado.estable();
  }
  montado.cambios();
  return montado;
}

describe('KPIs de Personas', () => {
  it('me deben y les debo suman las posiciones de todas las personas y entidades', async () => {
    const { component } = await montar([]);

    expect(component.peopleOwed()).toBe(650000);
    expect(component.peopleOwing()).toBe(2040000);
  });

  it('el total cuenta personas y entidades', async () => {
    const { store } = await montar([]);

    expect(store.data().people).toHaveLength(3);
  });

  it('el mayor retraso es la persona o entidad con más cuotas atrasadas', async () => {
    const { component } = await montar([
      credito('a', { id: 'banco', name: 'Banco Andino' }, 6, 12),
      credito('b', { id: 'ana', name: 'Ana' }, 2, 12),
    ]);

    const peor = component.slowestPayer();
    expect(peor.name).toBe('Banco Andino');
    expect(peor.days).toBeGreaterThan(0);
  });

  it('sin cuotas atrasadas dice que todos están al día', async () => {
    const { component } = await montar([credito('a', { id: 'ana', name: 'Ana' }, 0, 12)]);

    expect(component.slowestPayer().days).toBe(0);
    expect(component.slowestPayer().hintKey).toBe('people.kpi.slowest.hint.upToDate');
  });
});
