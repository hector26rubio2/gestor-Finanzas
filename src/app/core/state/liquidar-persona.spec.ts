import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { PeopleCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-liquidar-persona', template: '' })
class ComponenteVacio {
  readonly comandos = inject(PeopleCommands);
}

const liquidacion = {
  id: 'liq-1',
  counterparty: { id: 'persona-1', name: 'Camilo' },
  period: { start: '2026-11-01', end: '2026-11-01' },
  cutOff: '2026-11-01',
  currency: 'COP',
  openingBalance: { amount: '0', currency: 'COP' },
  charges: { amount: '90000', currency: 'COP' },
  interest: { amount: '0', currency: 'COP' },
  payments: { amount: '0', currency: 'COP' },
  closingBalance: { amount: '90000', currency: 'COP' },
  issuedAt: '2026-11-01T10:00:00Z',
};

describe('PeopleCommands.liquidar', () => {
  it('emite la liquidacion del mes con una sola peticion y la devuelve', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/settlements', { body: liquidacion });
    const { component, cambios } = pruebaRender(ComponenteVacio, {
      transport,
      session: sesionDe().conCapacidad(P.personas.liquidaciones.crear),
      data: datosDe(),
    });
    cambios();

    const emitida = await component.comandos.liquidar('persona-1', '2026-11-18');

    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual(['POST /api/v1/settlements']);
    expect(transport.peticiones[0].body).toEqual({
      counterparty: 'persona-1',
      period: { start: '2026-11-01', end: '2026-11-18' },
      cutOff: '2026-11-18',
      currency: 'COP',
    });
    expect(emitida.id).toBe('liq-1');
  });

  it('sin permiso de liquidar no toca la API', async () => {
    const transport = new TransportFalso();
    const { component, cambios } = pruebaRender(ComponenteVacio, {
      transport,
      session: sesionDe().sinCapacidades(),
      data: datosDe(),
    });
    cambios();

    await expect(component.comandos.liquidar('persona-1', '2026-11-18')).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });
});
