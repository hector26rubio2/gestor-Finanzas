import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AppStore, CatalogCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';
import type { Investment } from './view-model';

@Component({ selector: 'prueba-editar-inversion', template: '' })
class ComponenteVacio {
  readonly comandos = inject(CatalogCommands);
  readonly store = inject(AppStore);
}

const remota = (cambios: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  name: 'CEFAS',
  instrumentType: 'cdt',
  currency: 'COP',
  costBasis: { amount: '1', currency: 'COP' },
  marketValue: null,
  isActive: true,
  risk: 3,
  symbol: 'CEFA-X',
  ...cambios,
});

const local: Investment = {
  id: 'inv-1',
  name: 'CEFAS',
  type: 'cdt',
  cost: 1,
  value: 1,
  institution: '',
  currency: 'COP',
  units: 0,
  risk: 'Alto',
  liquidity: 'Programada',
  netContributions: 0,
  sinValoracion: true,
  symbol: 'CEFA-X',
};

function montar(inversiones: Investment[] = [local], activa = true) {
  const transport = new TransportFalso()
    .responder('GET /api/v1/investments', { body: [remota({ isActive: activa })] })
    .responder('PUT /api/v1/investments/inv-1', { body: remota() });
  const montado = pruebaRender(ComponenteVacio, { transport, data: datosDe({ investments: inversiones }) });
  montado.cambios();
  return { ...montado, transport };
}

const base = { name: 'CEFAS', instrumentType: 'cdt', risk: 3, symbol: 'CEFA-X' };
const put = (transport: TransportFalso) =>
  transport.peticiones.find((p) => p.method === 'PUT')?.body as Record<string, unknown>;
const inversion = (store: AppStore) => store.data().investments.find((i) => i.id === 'inv-1')!;

describe('editar una inversión: cada campo viaja a la API y se ve igual', () => {
  it('el nombre', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updateInvestment('inv-1', { ...base, name: '  Bonos  ' });

    expect(put(transport)).toMatchObject({ name: 'Bonos' });
    expect(inversion(store).name).toBe('Bonos');
  });

  it('el tipo de instrumento', async () => {
    const { component, transport, store } = montar();

    await component.comandos.updateInvestment('inv-1', { ...base, instrumentType: 'fondo' });

    expect(put(transport)).toMatchObject({ instrumentType: 'fondo' });
    expect(inversion(store).type).toBe('fondo');
  });

  it.each([
    [1, 'Bajo'],
    [2, 'Medio'],
    [3, 'Alto'],
  ])('el riesgo %i se guarda y se ve como %s', async (riesgo, etiqueta) => {
    const { component, transport, store } = montar();

    await component.comandos.updateInvestment('inv-1', { ...base, risk: riesgo });

    expect(put(transport)).toMatchObject({ risk: riesgo });
    expect(inversion(store).risk).toBe(etiqueta);
  });

  it('el símbolo, y un símbolo vacío lo quita', async () => {
    const primero = montar();
    await primero.component.comandos.updateInvestment('inv-1', { ...base, symbol: ' BON ' });
    expect(put(primero.transport)).toMatchObject({ symbol: 'BON' });
    expect(inversion(primero.store).symbol).toBe('BON');

    const segundo = montar();
    await segundo.component.comandos.updateInvestment('inv-1', { ...base, symbol: '   ' });
    expect(put(segundo.transport)).toMatchObject({ symbol: null });
    expect(inversion(segundo.store).symbol).toBeUndefined();
  });

  it('conserva si la inversión está activa', async () => {
    const { component, transport } = montar([local], false);

    await component.comandos.updateInvestment('inv-1', base);

    expect(put(transport)).toMatchObject({ isActive: false });
  });

  it('al terminar cierra el formulario y avisa', async () => {
    const { component, store } = montar();
    store.form.set({ kind: 'investment', targetId: 'inv-1' });

    await component.comandos.updateInvestment('inv-1', { ...base, name: 'Bonos' });

    expect(store.form()).toBeNull();
    expect(store.toast.texto()).not.toBe('');
  });

  it('un nombre vacío no llama a la API', async () => {
    const { component, transport } = montar();

    await expect(component.comandos.updateInvestment('inv-1', { ...base, name: '  ' })).rejects.toThrow();

    expect(transport.peticiones.filter((p) => p.method === 'PUT')).toEqual([]);
  });

  it('una inversión que ya no existe avisa y no llama a la API', async () => {
    const { component, transport } = montar([]);

    await expect(component.comandos.updateInvestment('inv-1', base)).rejects.toThrow();

    expect(transport.peticiones.filter((p) => p.method === 'PUT')).toEqual([]);
  });
});
