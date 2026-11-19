import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ApiCategory } from '@core/api';
import { P } from '@core/session/permissions';
import { AppStore, CatalogCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import type { Movement } from './view-model';

@Component({ selector: 'prueba-desactivar-categoria', template: '' })
class ComponenteVacio {
  readonly comandos = inject(CatalogCommands);
  readonly store = inject(AppStore);
}

const categoria = (cambios: Partial<ApiCategory> = {}): ApiCategory => ({
  id: 'cat-1',
  name: 'Mercado',
  type: 2,
  color: '#112233',
  icon: 'cart',
  parent: 'cat-padre',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  ...cambios,
});

const movimiento: Movement = {
  id: 'm1',
  date: '2026-10-01',
  description: 'Compra',
  accountId: 'a',
  category: 'Mercado',
  kind: 'expense',
  amount: -100,
  status: 'confirmed',
};

function montar(opciones: { capacidades?: string[]; respuesta?: object } = {}) {
  const transport = new TransportFalso().responder(
    'PUT /api/v1/categories/cat-1',
    opciones.respuesta ?? (({ body }: { body: unknown }) => ({ body: { ...categoria(), ...(body as object) } })),
  );
  const montado = pruebaRender(ComponenteVacio, {
    transport,
    session: sesionDe().conCapacidad(...(opciones.capacidades ?? [P.cuentas.categorias.editar])),
    data: datosDe({ movements: [movimiento] }),
  });
  montado.store.categories.set([categoria()]);
  montado.cambios();
  return { ...montado, transport };
}

const put = (transport: TransportFalso) => transport.peticiones.find((p) => p.method === 'PUT')?.body as ApiCategory;
const guardada = (store: AppStore) => store.categories().find((c) => c.id === 'cat-1')!;

describe('desactivar una categoría', () => {
  it('la marca inactiva en la API conservando nombre, color, ícono y padre', async () => {
    const { component, transport, store } = montar();

    await component.comandos.desactivarCategoria('cat-1');

    expect(put(transport)).toMatchObject({
      name: 'Mercado',
      color: '#112233',
      icon: 'cart',
      parent: 'cat-padre',
      isActive: false,
    });
    expect(guardada(store).isActive).toBe(false);
  });

  it('los movimientos que la usan conservan su categoría', async () => {
    const { component, store } = montar();

    await component.comandos.desactivarCategoria('cat-1');

    expect(store.data().movements[0].category).toBe('Mercado');
  });

  it('avisa con el nombre de la categoría', async () => {
    const { component, store } = montar();

    await component.comandos.desactivarCategoria('cat-1');

    expect(store.toast.texto()).toContain('Mercado');
  });

  it('sin permiso de editar categorías no llama a la API', async () => {
    const { component, transport } = montar({ capacidades: [P.cuentas.categorias.listar] });

    await expect(component.comandos.desactivarCategoria('cat-1')).rejects.toThrow();

    expect(transport.peticiones).toEqual([]);
  });

  it('una categoría que ya no existe avisa y no llama a la API', async () => {
    const { component, transport } = montar();

    await expect(component.comandos.desactivarCategoria('otra')).rejects.toThrow();

    expect(transport.peticiones).toEqual([]);
  });

  it('si la API falla la categoría sigue activa', async () => {
    const { component, store } = montar({ respuesta: { error: { status: 500 } } });

    await expect(component.comandos.desactivarCategoria('cat-1')).rejects.toBeDefined();

    expect(guardada(store).isActive).toBe(true);
  });
});
