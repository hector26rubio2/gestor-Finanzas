import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ApiCategory } from '@core/api';
import { AppStore, CatalogCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';
import type { Movement } from './view-model';

@Component({ selector: 'prueba-editar-categoria', template: '' })
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

function montar(actual = categoria()) {
  const transport = new TransportFalso().responder('PUT /api/v1/categories/cat-1', ({ body }) => ({
    body: { ...actual, ...(body as object) },
  }));
  const montado = pruebaRender(ComponenteVacio, { transport, data: datosDe({ movements: [movimiento] }) });
  montado.store.categories.set([actual]);
  montado.cambios();
  return { ...montado, transport };
}

const base = { name: 'Mercado', color: '#112233', icon: 'cart' };
const put = (transport: TransportFalso) => transport.peticiones.find((p) => p.method === 'PUT')?.body as ApiCategory;
const guardada = (store: AppStore) => store.categories().find((c) => c.id === 'cat-1')!;

describe('editar una categoría: cada campo viaja a la API y se ve igual', () => {
  it('el nombre, recortado', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updateCategory('cat-1', { ...base, name: '  Supermercado  ' });

    expect(put(transport).name).toBe('Supermercado');
    expect(guardada(store).name).toBe('Supermercado');
  });

  it('el color', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updateCategory('cat-1', { ...base, color: '#ff8800' });

    expect(put(transport).color).toBe('#ff8800');
    expect(guardada(store).color).toBe('#ff8800');
  });

  it('el ícono', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updateCategory('cat-1', { ...base, icon: 'home' });

    expect(put(transport).icon).toBe('home');
    expect(guardada(store).icon).toBe('home');
  });

  it('conserva la categoría padre y si está activa', async () => {
    const { component, transport } = montar(categoria({ isActive: false }));

    await component.comandos.updateCategory('cat-1', { ...base, name: 'Otra' });

    expect(put(transport)).toMatchObject({ parent: 'cat-padre', isActive: false });
  });

  it('renombrar actualiza el nombre en todos los movimientos de esa categoría', async () => {
    const { component, store } = montar();

    await component.comandos.updateCategory('cat-1', { ...base, name: 'Supermercado' });

    expect(store.data().movements[0].category).toBe('Supermercado');
  });

  it('cambiar solo color o ícono no toca los movimientos', async () => {
    const { component, store } = montar();

    await component.comandos.updateCategory('cat-1', { ...base, color: '#ff8800' });

    expect(store.data().movements[0].category).toBe('Mercado');
  });

  it('al terminar cierra el formulario y avisa', async () => {
    const { component, store } = montar();
    store.form.set({ kind: 'category', targetId: 'cat-1' });

    await component.comandos.updateCategory('cat-1', { ...base, name: 'Supermercado' });

    expect(store.form()).toBeNull();
    expect(store.toast.texto()).toContain('Supermercado');
  });

  it('un nombre vacío o una categoría inexistente no llaman a la API', async () => {
    const { component, transport } = montar();

    await expect(component.comandos.updateCategory('cat-1', { ...base, name: '  ' })).rejects.toThrow();
    await expect(component.comandos.updateCategory('otra', base)).rejects.toThrow();

    expect(transport.peticiones.filter((p) => p.method === 'PUT')).toEqual([]);
  });
});
