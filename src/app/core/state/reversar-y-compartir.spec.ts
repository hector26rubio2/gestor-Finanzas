import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { MovementCommands } from '@core/state';
import type { Movement } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-reversar-compartir', template: '' })
class ComponenteVacio {
  readonly comandos = inject(MovementCommands);
}

const compra: Movement = {
  id: 'mov-1',
  date: '2026-09-25',
  description: 'Mercado',
  accountId: 'cuenta-1',
  category: 'Mercado',
  kind: 'expense',
  amount: -45_900,
  status: 'confirmed',
  person: 'Camilo',
};

function preparar(permisos: string[]) {
  const transport = new TransportFalso()
    .responder('POST /api/v1/movements/mov-1/reversal', { body: {} })
    .responder('POST /api/v1/shared-purchases', { body: {} });
  const { component, cambios } = pruebaRender(ComponenteVacio, {
    transport,
    session: sesionDe()
      .sinCapacidades()
      .conCapacidad(...permisos),
    data: datosDe({ movements: [compra] }),
  });
  cambios();
  return { transport, comandos: component.comandos };
}

describe('MovementCommands.reversar', () => {
  it('pide un solo reverso con fecha y motivo, sin descargar listas', async () => {
    const { transport, comandos } = preparar([P.movimientos.deshabilitar]);

    await comandos.reversar(compra);

    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual(['POST /api/v1/movements/mov-1/reversal']);
    expect(transport.peticiones[0].body).toMatchObject({ reason: 'Reversado desde la aplicación' });
  });

  it('sin permiso no toca la API', async () => {
    const { transport, comandos } = preparar([]);

    await expect(comandos.reversar(compra)).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });
});

describe('MovementCommands.compartir', () => {
  it('reparte la compra entera con la persona, en una sola peticion', async () => {
    const { transport, comandos } = preparar([P.personas.compras.crear]);

    await comandos.compartir(compra);

    expect(transport.peticiones.map((p) => `${p.method} ${p.path}`)).toEqual(['POST /api/v1/shared-purchases']);
    expect(transport.peticiones[0].body).toEqual({
      purchaseMovement: 'mov-1',
      shares: [{ counterparty: 'persona-1', basis: 1 }],
      description: 'Mercado',
    });
  });

  it('sin permiso o con una persona desconocida no toca la API', async () => {
    const sinPermiso = preparar([]);
    await expect(sinPermiso.comandos.compartir(compra)).rejects.toThrow();
    const desconocida = preparar([P.personas.compras.crear]);
    await expect(desconocida.comandos.compartir({ ...compra, person: 'Nadie' })).rejects.toThrow();
    expect(sinPermiso.transport.peticiones).toHaveLength(0);
    expect(desconocida.transport.peticiones).toHaveLength(0);
  });
});
