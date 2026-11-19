import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { INVESTMENT_OPERATION } from '@core/api';
import { CatalogCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-operaciones-de-inversion', template: '' })
class ComponenteVacio {
  readonly comandos = inject(CatalogCommands);
}

function montar() {
  const transport = new TransportFalso().responder('POST /api/v1/investments/inv-1/operations', {
    body: { movement: null, type: 1, date: '2026-10-29', amount: { amount: '1', currency: 'COP' } },
  });
  const montado = pruebaRender(ComponenteVacio, { data: datosDe(), transport });
  montado.cambios();
  return { ...montado, transport };
}

const cuerpo = (transport: TransportFalso) => transport.peticiones[0].body as Record<string, unknown>;

describe('operaciones de inversión: lo que se envía por tipo', () => {
  it('una venta envía cantidad y precio unitario, con la cuenta donde entra el dinero', async () => {
    const { component, transport } = montar();

    await component.comandos.registerInvestmentOperation('inv-1', {
      type: INVESTMENT_OPERATION.sell,
      date: '2026-10-29',
      amount: 1200,
      currency: 'COP',
      account: 'ahorros',
      quantity: 10,
      unitPrice: 120,
    });

    expect(cuerpo(transport)).toMatchObject({
      type: INVESTMENT_OPERATION.sell,
      amount: { amount: '1200', currency: 'COP' },
      account: 'ahorros',
      quantity: '10',
      unitPrice: { amount: '120', currency: 'COP' },
    });
  });

  it.each([
    ['un retiro', INVESTMENT_OPERATION.withdrawal],
    ['un dividendo', INVESTMENT_OPERATION.dividend],
    ['una comisión', INVESTMENT_OPERATION.fee],
  ])('%s envía solo monto, fecha y cuenta, sin cantidad ni precio', async (_nombre, tipo) => {
    const { component, transport } = montar();

    await component.comandos.registerInvestmentOperation('inv-1', {
      type: tipo,
      date: '2026-10-29',
      amount: 50,
      currency: 'USD',
      account: 'usd',
    });

    const enviado = cuerpo(transport);
    expect(enviado).toMatchObject({ type: tipo, amount: { amount: '50', currency: 'USD' }, account: 'usd' });
    expect(enviado).not.toHaveProperty('quantity');
    expect(enviado).not.toHaveProperty('unitPrice');
  });

  it('sin cuenta no envía el campo y una descripción en blanco se omite', async () => {
    const { component, transport } = montar();

    await component.comandos.registerInvestmentOperation('inv-1', {
      type: INVESTMENT_OPERATION.fee,
      date: '2026-10-29',
      amount: 5,
      currency: 'COP',
      description: '   ',
    });

    expect(cuerpo(transport)).not.toHaveProperty('account');
    expect(cuerpo(transport)).not.toHaveProperty('description');
  });

  it('al registrar invalida el listado de movimientos para que el historial se vea', async () => {
    const { component, store } = montar();
    store.movimientosListos.set(true);

    await component.comandos.registerInvestmentOperation('inv-1', {
      type: INVESTMENT_OPERATION.contribution,
      date: '2026-10-29',
      amount: 100,
      currency: 'COP',
      account: 'a',
    });

    expect(store.movimientosListos()).toBe(false);
  });
});
