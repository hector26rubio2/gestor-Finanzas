import { Component } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { OrigenDelMovimiento } from './origen-del-movimiento';

@Component({ selector: 'prueba-origen', template: '' })
class ComponenteOrigen {
  readonly origen = new OrigenDelMovimiento();
}

function preparar() {
  const { store, component, cambios } = pruebaRender(ComponenteOrigen, { data: datosDe() });
  store.data.update((data) => ({
    ...data,
    accounts: [{ id: 'visa', name: 'Visa', type: 'credit', currency: 'COP' } as never],
  }));
  return { store, origen: component.origen, cambios };
}

describe('OrigenDelMovimiento', () => {
  it('desde la tarjeta abre el movimiento y vuelve a la tarjeta', () => {
    const { store, origen } = preparar();
    store.inspect('card', 'visa');

    origen.abrirMovimiento('compra-1');
    expect(store.inspector()).toEqual(expect.objectContaining({ type: 'movement', id: 'compra-1' }));
    expect(origen.cuentaDeOrigen()?.name).toBe('Visa');

    origen.volver();
    expect(store.inspector()).toEqual(expect.objectContaining({ type: 'card', id: 'visa' }));
    expect(origen.cuentaDeOrigen()).toBeNull();
  });

  it('al cerrar el panel olvida de dónde venía', () => {
    const { store, origen, cambios } = preparar();
    store.inspect('card', 'visa');
    origen.abrirMovimiento('compra-1');

    store.inspector.set(null);
    cambios();
    store.inspect('movement', 'compra-1');

    expect(origen.cuentaDeOrigen()).toBeNull();
  });
});
