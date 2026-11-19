import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { AppStore, PeopleCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-editar-persona', template: '' })
class ComponenteVacio {
  readonly comandos = inject(PeopleCommands);
  readonly store = inject(AppStore);
}

const remota = (cambios: Record<string, unknown> = {}) => ({
  id: 'persona-1',
  displayName: 'Camilo',
  alias: null,
  email: null,
  phone: '123',
  notes: null,
  isActive: true,
  createdAt: '2026-09-01',
  kind: 1,
  ...cambios,
});

function montar(personas = [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0, relationship: 'Amistad' as const }]) {
  const transport = new TransportFalso()
    .responder('GET /api/v1/people', { body: [remota()] })
    .responder('PUT /api/v1/people/persona-1', { body: remota() });
  const montado = pruebaRender(ComponenteVacio, {
    transport,
    session: sesionDe().conCapacidad(P.personas.ver, P.personas.editar),
    data: datosDe({ people: personas }),
  });
  montado.cambios();
  return { ...montado, transport };
}

const put = (transport: TransportFalso) =>
  transport.peticiones.find((p) => p.method === 'PUT')?.body as Record<string, unknown>;
const persona = (store: AppStore) => store.data().people.find((p) => p.id === 'persona-1')!;

describe('editar una persona', () => {
  it('cambiar la relación la envía a la API y la deja en la lista', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updatePerson('persona-1', { name: 'Camilo', relationship: 'Trabajo' });

    expect(put(transport)).toMatchObject({ relationship: 'Trabajo' });
    expect(persona(store).relationship).toBe('Trabajo');
  });

  it('cambiar solo el nombre conserva la relación que ya tenía', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updatePerson('persona-1', { name: 'Camilo Rojas' });

    expect(put(transport)).not.toHaveProperty('relationship');
    expect(persona(store)).toMatchObject({ name: 'Camilo Rojas', relationship: 'Amistad' });
  });

  it('nombre y relación juntos se guardan y se cierra el formulario con aviso', async () => {
    const { component, store } = montar();
    store.form.set({ kind: 'person', targetId: 'persona-1' });

    await component.comandos.updatePerson('persona-1', { name: 'Camilo R.', relationship: 'Familia' });

    expect(persona(store)).toMatchObject({ name: 'Camilo R.', relationship: 'Familia' });
    expect(store.form()).toBeNull();
    expect(store.toast.texto()).toContain('Camilo R.');
  });

  it('un nombre vacío no llama a la API', async () => {
    const { component, transport } = montar();

    await expect(component.comandos.updatePerson('persona-1', { name: '   ' })).rejects.toThrow();

    expect(transport.peticiones.filter((p) => p.method === 'PUT')).toEqual([]);
  });

  it('una persona que ya no existe avisa y no llama a la API', async () => {
    const { component, transport } = montar([]);

    await expect(component.comandos.updatePerson('persona-1', { name: 'Camilo' })).rejects.toThrow();

    expect(transport.peticiones.filter((p) => p.method === 'PUT')).toEqual([]);
  });

  it('renombrar actualiza el nombre en los movimientos de esa persona', async () => {
    const montado = pruebaRender(ComponenteVacio, {
      transport: new TransportFalso()
        .responder('GET /api/v1/people', { body: [remota()] })
        .responder('PUT /api/v1/people/persona-1', { body: remota() }),
      session: sesionDe().conCapacidad(P.personas.ver, P.personas.editar),
      data: datosDe({
        people: [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 }],
        movements: [
          {
            id: 'm1',
            date: '2026-09-25',
            description: 'Prestado',
            accountId: 'a',
            category: 'Varios',
            kind: 'expense',
            amount: -100,
            status: 'confirmed',
            person: 'Camilo',
          },
        ],
      }),
    });
    montado.cambios();

    await montado.component.comandos.updatePerson('persona-1', { name: 'Camilo Rojas' });

    expect(montado.store.data().movements[0].person).toBe('Camilo Rojas');
  });
});
