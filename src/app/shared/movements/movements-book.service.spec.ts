import { Component, inject } from '@angular/core';
import { ApiMovement } from '@core/api';
import { CashFlow, EconomicEffect, MovementKind } from '@core/utils/movement-kinds';
import { MovementCommands } from '@core/state';
import { P } from '@core/session';
import { MovementsBookService } from './movements-book.service';
import { TableFilter } from '@ui/data-table';
import { describe, expect, it } from 'vitest';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';

const sesionConPermisos = sesionDe().conCapacidad(P.movimientos.ver);

@Component({ selector: 'prueba-libro-movimientos', template: '' })
class ComponenteLibro {
  readonly comandos = inject(MovementCommands);
  readonly book = inject(MovementsBookService);
}

/**
 * Fábrica de ApiMovement para las respuestas del transport falso:
 * replica la forma cruda del backend (montos como string, links/linkNames).
 * (Misma forma que usa movement-commands.spec.ts para el /movements de alta.)
 */
function apiMovement(opts: { id: string } & Partial<ApiMovement>): ApiMovement {
  return {
    date: '2026-10-20',
    kind: MovementKind.expense,
    effect: EconomicEffect.expense,
    flow: CashFlow.outflow,
    amount: {
      original: { amount: '45900', currency: 'COP' },
      base: { amount: '45900', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-09-25',
    },
    cardBucket: null,
    purchaseApr: null,
    links: {},
    linkNames: {},
    ...opts,
  } as ApiMovement;
}

/** Página del /movements/search con los ids dados (orden del servidor, sin el backdated). */
function paginaCon(ids: readonly string[], total = ids.length) {
  return {
    body: {
      items: ids.map((id) =>
        apiMovement({
          id,
          date: '2026-10-20',
          links: { account: 'cuenta-1' },
          linkNames: { account: { id: 'cuenta-1', name: 'Ahorros' } },
        }),
      ),
      page: 1,
      size: 25,
      total,
      totalPages: 1,
      hasNext: false,
      nextCursor: null,
    },
  };
}

describe('MovementsBookService — refetch tras el invalidado del listado (ticket 27)', () => {
  it('el refetch tras navegar conserva el movimiento recién guardado fuera de página 1: el libro no lo oculta', async () => {
    // Servidor: la página 1 (orden por fecha desc) no incluye el movimiento
    // backdated; el total del servidor SÍ lo cuenta → KPIs vs libro desalineados.
    const transport = new TransportFalso()
      .responder('POST /api/v1/movements', {
        body: apiMovement({ id: 'mov-backdated', date: '2026-01-05', links: { account: 'cuenta-2' } }),
      })
      .responder('POST /api/v1/movements/search', paginaCon(['mov-1'], 2));

    const { store, component, cambios } = pruebaRender(ComponenteLibro, {
      data: datosDe(),
      transport,
      session: sesionConPermisos,
    });
    cambios();

    // Alta con fecha vieja: copia optimista + invalidación del listado remoto.
    await component.comandos.save({
      kind: 'expense',
      date: '2026-01-05',
      description: 'Arreglo del garage',
      accountId: 'cuenta-2',
      amount: 45900,
      category: 'Mercado',
    });
    expect(component.book.movementRows().map((fila) => (fila['raw'] as { id: string }).id)).toContain('mov-backdated');

    // Navegar al libro: el guard llama asegurarPrimeraPagina (routes.ts).
    await component.book.asegurarPrimeraPagina();

    // Criterio: el libro no muestra menos de lo que el usuario acaba de guardar.
    const ids = component.book.movementRows().map((fila) => (fila['raw'] as { id: string }).id);
    expect(ids).toContain('mov-1');
    expect(ids).toContain('mov-backdated');
    // Y el total del servidor nunca mintió: 2 números (mov-1 + mov-backdated).
    expect(store.remoteMovementTotal()).toBe(2);
  });

  it('con filtros fijados de servidor (pinned) activos el refetch no hereda movimientos fuera de filtro', async () => {
    const transport = new TransportFalso()
      .responder('POST /api/v1/movements', {
        body: apiMovement({ id: 'mov-backdated', date: '2026-01-05', links: { account: 'cuenta-2' } }),
      })
      .responder('POST /api/v1/movements/search', paginaCon(['mov-1'], 2));

    const { component, cambios } = pruebaRender(ComponenteLibro, {
      data: datosDe(),
      transport,
      session: sesionConPermisos,
    });
    cambios();

    await component.comandos.save({
      kind: 'expense',
      date: '2026-01-05',
      description: 'Arreglo del garage',
      accountId: 'cuenta-2',
      amount: 45900,
      category: 'Mercado',
    });

    // El usuario fija un filtro de fecha antes del refetch: la página del servidor manda.
    component.book.pinned.set([{ field: 'date', value: '10/2026' } as TableFilter]);
    await component.book.loadMovementPage(1);

    const ids = component.book.movementRows().map((fila) => (fila['raw'] as { id: string }).id);
    expect(ids).toEqual(['mov-1']);
  });

  it('la paginación normal (sin invalidación) no fusiona: cada página carga su listado limpio', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements/search', paginaCon(['mov-grupo-2'], 42));
    const { component, cambios } = pruebaRender(ComponenteLibro, {
      data: datosDe(),
      transport,
      session: sesionConPermisos,
    });
    cambios();

    // Navegación de página con cursor: sin invalidación previa.
    await component.book.loadMovementPage(2);

    const ids = component.book.movementRows().map((fila) => (fila['raw'] as { id: string }).id);
    expect(ids).toEqual(['mov-grupo-2']);
  });
});
