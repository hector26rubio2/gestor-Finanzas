import { provideRouter } from '@angular/router';
import { type Provider } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { CalendarTabComponent } from './calendar-tab';

const RECURRENTE = {
  id: 'rec-1',
  name: 'Arriendo',
  kind: 2,
  movementTemplate: null,
  amount: { amount: '900000', currency: 'COP' },
  target: {},
  sourceAccount: null,
  destinationAccount: null,
  schedule: { frequency: 3, interval: 1, start: '2026-01-05', end: null, dayOfMonth: 5, dayOfWeek: null },
  isActive: true,
  nextOccurrence: '2026-12-05',
  materializedOccurrences: [],
  createdAt: '2026-01-01T00:00:00Z',
};

const OCURRENCIA = {
  recurrence: { id: RECURRENTE.id, name: RECURRENTE.name },
  occurrence: '2026-12-05',
  amount: RECURRENTE.amount,
  kind: 2,
};

const proveedores: Provider[] = [provideRouter([]) as unknown as Provider];

function montar(ajustar: (transport: TransportFalso) => TransportFalso) {
  const transport = ajustar(
    new TransportFalso()
      .responder(/^POST \/api\/v1\/movements\/search/, { body: { items: [], hasNext: false } })
      .responder('GET /api/v1/calendar/projected', { body: [OCURRENCIA] })
      .responder('GET /api/v1/recurrences/inactive', { body: [] })
      .responder('GET /api/v1/recurrences', { body: [RECURRENTE] }),
  );
  const montado = pruebaRender(CalendarTabComponent, {
    session: sesionDe().conCapacidad(
      P.calendario.ver,
      P.calendario.recurrencias.listar,
      P.calendario.recurrencias.deshabilitar,
      P.calendario.proyecciones.crear,
    ),
    data: datosDe(),
    providers: proveedores,
    transport,
  });
  return { ...montado, transport };
}

async function cargado(montado: ReturnType<typeof montar>) {
  montado.cambios();
  await montado.estable();
  montado.cambios();
  montado.transport.peticiones.length = 0;
  return montado;
}

const rutas = (transport: TransportFalso) => transport.peticiones.map((p) => `${p.method} ${p.path}`);

describe('calendario, eliminar un recurrente', () => {
  it('borra la serie y vuelve a cargar la proyección', async () => {
    const { component, transport, store, estable } = await cargado(
      montar((t) => t.responder('DELETE /api/v1/recurrences/rec-1', { body: null })),
    );
    component.porEliminar.set(RECURRENTE as never);

    await component.eliminarRecurrente();
    await estable();

    const llamadas = rutas(transport);
    expect(llamadas[0]).toBe('DELETE /api/v1/recurrences/rec-1');
    expect(llamadas).toContain('GET /api/v1/recurrences');
    expect(component.porEliminar()).toBeNull();
    expect(store.toast.texto()).toContain('Arriendo');
  });

  it('si la API falla avisa y no recarga', async () => {
    const { component, transport, store } = await cargado(
      montar((t) => t.responder('DELETE /api/v1/recurrences/rec-1', { error: { status: 500 } })),
    );
    component.porEliminar.set(RECURRENTE as never);

    await component.eliminarRecurrente();

    expect(rutas(transport)).toEqual(['DELETE /api/v1/recurrences/rec-1']);
    expect(store.toast.texto()).not.toContain('Arriendo');
    expect(store.toast.texto()).not.toBe('');
  });

  it('sin una serie elegida no llama a la API', async () => {
    const { component, transport } = await cargado(montar((t) => t));

    await component.eliminarRecurrente();

    expect(transport.peticiones).toEqual([]);
  });
});

describe('calendario, materializar una ocurrencia', () => {
  it('crea el movimiento de esa fecha con una clave nueva y recarga', async () => {
    const { component, transport, store } = await cargado(
      montar((t) =>
        t.responder('POST /api/v1/recurrences/rec-1/materializations', { body: { movement: { id: 'mov-9' } } }),
      ),
    );

    await component.materialize(OCURRENCIA as never);

    const post = transport.peticiones.find((p) => p.method === 'POST' && p.path.endsWith('/materializations'));
    expect(post?.body).toMatchObject({ occurrence: '2026-12-05' });
    expect((post?.body as { idempotencyKey: string }).idempotencyKey).toBeTruthy();
    expect(rutas(transport)).toContain('GET /api/v1/calendar/projected');
    expect(store.toast.texto()).not.toBe('');
  });

  it('cada confirmación usa su propia clave de idempotencia', async () => {
    const { component, transport } = await cargado(
      montar((t) => t.responder('POST /api/v1/recurrences/rec-1/materializations', { body: {} })),
    );

    await component.materialize(OCURRENCIA as never);
    await component.materialize(OCURRENCIA as never);

    const claves = transport.peticiones
      .filter((p) => p.path.endsWith('/materializations'))
      .map((p) => (p.body as { idempotencyKey: string }).idempotencyKey);
    expect(new Set(claves).size).toBe(2);
  });

  it('si la API rechaza avisa y no recarga la proyección', async () => {
    const { component, transport, store } = await cargado(
      montar((t) =>
        t.responder('POST /api/v1/recurrences/rec-1/materializations', {
          error: { status: 400, code: 'recurrence.occurrence_invalid', detail: 'La ocurrencia ya fue confirmada.' },
        }),
      ),
    );

    await component.materialize(OCURRENCIA as never);

    expect(rutas(transport)).toEqual(['POST /api/v1/recurrences/rec-1/materializations']);
    expect(store.toast.texto()).not.toBe('');
  });
});
