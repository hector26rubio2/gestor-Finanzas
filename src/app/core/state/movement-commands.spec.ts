import { Component, inject } from '@angular/core';
import { ApiMovement, ApiOperation } from '@core/api/ledger.api';
import { MovementCommands } from '@core/state';
import { Movement } from '@core/state/view-model';
import { cuotaEnCurso } from '@core/session/mappers/movements.mapper';
import { ModeloDeDatos } from '@testing/datos-de-prueba';
import { CashFlow, EconomicEffect, MovementKind } from '@core/utils/movement-kinds';
import { describe, expect, it } from 'vitest';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';

@Component({ selector: 'prueba-comandos-movimiento', template: '' })
class ComponenteVacio {
  readonly comandos = inject(MovementCommands);
}

/**
 * Fábrica de ApiMovement para las respuestas del transport falso:
 * replica la forma cruda del backend (montos como string, links/linkNames).
 */
function apiMovement(opts: { id: string } & Partial<ApiMovement>): ApiMovement {
  return {
    date: '2026-09-25',
    kind: MovementKind.expense,
    effect: EconomicEffect.expense,
    flow: CashFlow.outflow,
    amount: {
      original: { amount: '45900', currency: 'COP' },
      base: { amount: '45900', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-09-25',
    },
    links: {},
    linkNames: {},
    origin: 0,
    description: 'Respuesta del servidor',
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...opts,
  } as ApiMovement;
}

function operacion(id: string, legs: readonly ApiMovement[]): ApiOperation {
  return {
    id,
    kind: legs[0]?.kind ?? 0,
    date: legs[0]?.date ?? '2026-09-25',
    description: null,
    createdAt: '2026-09-25T12:00:00Z',
    legs,
  };
}

const montoDe = (cantidad: string) => ({
  original: { amount: cantidad, currency: 'COP' },
  base: { amount: cantidad, currency: 'COP' },
  rate: '1',
  rateAsOf: '2026-09-25',
});

/** Envenena el listado remoto para verificar invalidación tras cada comando. */
function envenenarListado(store: ReturnType<typeof pruebaRender<ComponenteVacio>>['store']): void {
  store.remoteMovementPage.set(3);
  store.remoteMovementCursor.set('cursor-7');
  store.remoteMovementTotal.set(42);
  store.remoteMovementTotals.set({ income: 500, expense: 300 });
  store.movimientosListos.set(true);
}

describe('MovementCommands.asentar — alta de movimientos', () => {
  it('gasto simple en efectivo: envía kind/effect/flow/amount y añade la copia optimista con signo negativo', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements', {
      body: apiMovement({
        id: 'mov-nuevo',
        links: { account: 'cuenta-2', category: 'categoria-1' },
        linkNames: { category: { id: 'categoria-1', name: 'Mercado' } },
      }),
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();
    envenenarListado(store);

    await component.comandos.asentar({
      tipo: 'gasto',
      fecha: '2026-10-01',
      descripcion: 'Almuerzo',
      cuentaId: 'cuenta-2',
      monto: 45900,
      categoria: 'Mercado',
      recurrente: false,
    });

    const [peticion] = transport.peticiones;
    expect(peticion.method).toBe('POST');
    expect(peticion.path).toBe('/api/v1/movements');
    expect(peticion.body).toMatchObject({
      date: '2026-10-01',
      kind: 2,
      effect: 2,
      flow: 2,
      amount: { amount: '45900', currency: 'COP' },
      links: { account: 'cuenta-2', category: 'categoria-1' },
      description: 'Almuerzo',
    });
    expect((peticion.body as { idempotencyKey: string }).idempotencyKey).toEqual(expect.any(String));

    const creado: Movement = store.data().movements[0];
    expect(creado).toMatchObject({
      id: 'mov-nuevo',
      date: '2026-09-25',
      description: 'Respuesta del servidor',
      accountId: 'cuenta-2',
      category: 'Mercado',
      kind: 'expense',
      amount: -45900,
      status: 'confirmed',
      ownership: 'own',
    });
    expect(creado.loanProduct).toBeUndefined();
    expect(creado.loanRole).toBeUndefined();
    expect(store.form()).toBeNull();
    expect(store.data().movements).toHaveLength(2);
  });

  it('compra con tarjeta: kind 20 con enlace card, cuotas y APR que devuelve el servidor', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements', {
      body: apiMovement({
        id: 'mov-tarjeta',
        kind: MovementKind.cardPurchase,
        links: { card: 'tarjeta-1' },
        installments: 3,
        cardBucket: 2,
        purchaseApr: 12.683,
      }),
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, limit: 5000000 },
        ],
        people: [],
      }),
      transport,
    });
    cambios();
    envenenarListado(store);

    await component.comandos.asentar({
      tipo: 'gasto',
      fecha: '2026-10-01',
      descripcion: 'Nevera',
      cuentaId: 'tarjeta-1',
      monto: 45900,
      categoria: 'Mercado',
      recurrente: false,
      cuotas: 3,
      tasaDeCuota: 2,
      balde: 2,
    });

    const [peticion] = transport.peticiones;
    expect(peticion.path).toBe('/api/v1/movements');
    expect(peticion.body).toMatchObject({
      kind: 20, // MovementKind.cardPurchase solo porque la cuenta es de crédito
      links: { card: 'tarjeta-1', category: 'categoria-1' },
      installments: 3,
      cardBucket: 2,
    });
    const creado = store.data().movements[0];
    expect(creado).toMatchObject({
      id: 'mov-tarjeta',
      accountId: 'tarjeta-1',
      amount: -45900,
      installmentTotal: 3,
      installmentCurrent: cuotaEnCurso('2026-09-25', 3),
      cardBucket: 2,
    });
    expect(creado.purchaseApr).toBe(12.683);
  });

  it('transferencia dos patas: una operación con pata saliente y entrante, categoría Transferencias', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/operations/transfers', {
      body: operacion('op-1', [
        apiMovement({
          id: 'pata-salida',
          kind: MovementKind.transferOut,
          effect: EconomicEffect.neutral,
          flow: CashFlow.outflow,
          links: { account: 'cuenta-1' },
          description: 'Mover ahorro',
          amount: montoDe('50000'),
        }),
        apiMovement({
          id: 'pata-entrada',
          kind: MovementKind.transferIn,
          effect: EconomicEffect.neutral,
          flow: CashFlow.inflow,
          links: { account: 'cuenta-2' },
          description: 'Mover ahorro',
          amount: montoDe('50000'),
        }),
      ]),
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({ movements: [] }),
      transport,
    });
    cambios();
    envenenarListado(store);

    await component.comandos.asentar({
      tipo: 'transferencia',
      fecha: '2026-10-01',
      descripcion: 'Mover ahorro',
      origenId: 'cuenta-1',
      destinoId: 'cuenta-2',
      monto: 50000,
    });

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/operations/transfers' });
    expect(peticion.body).toMatchObject({
      amount: { amount: '50000', currency: 'COP' },
      sourceAccount: 'cuenta-1',
      destinationAccount: 'cuenta-2',
      description: 'Mover ahorro',
    });
    expect(peticion.body !== undefined && 'idempotencyKey' in (peticion.body as object)).toBe(true);

    const patas = store.data().movements;
    expect(patas).toHaveLength(2);
    expect(patas[0]).toMatchObject({
      id: 'pata-salida',
      accountId: 'cuenta-1',
      kind: 'expense',
      movementSubtype: 'transfer',
      amount: -50000,
      status: 'confirmed',
    });
    expect(patas[1]).toMatchObject({
      id: 'pata-entrada',
      accountId: 'cuenta-2',
      kind: 'income',
      movementSubtype: 'transfer',
      amount: 50000,
    });
    expect(patas.every((m) => m.category === 'Transferencias')).toBe(true);
    expect(store.form()).toBeNull();
  });

  it('préstamo (operationType credit): exige contraparte por counterpartyId y graba la pata', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/loans', {
      body: {
        obligation: { id: 'obligacion-1', counterparty: { id: 'persona-1', name: 'Camilo' }, dueOn: null },
        terms: { product: 1, monthlyRate: 0.01, termMonths: 12, cardMode: null },
        movements: [apiMovement({ id: 'pata-deuda', flow: CashFlow.outflow, amount: montoDe('100000') })],
      },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({ movements: [], people: [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 }] }),
      transport,
    });
    cambios();
    envenenarListado(store);

    await component.comandos.asentar({
      tipo: 'prestamo',
      sentido: 'otorgado',
      fecha: '2026-10-01',
      descripcion: 'Préstamo',
      cuentaId: 'cuenta-1',
      contraparteId: 'persona-1',
      monto: 100000,
      producto: 'personal',
      tasaMensual: 1,
      plazoMeses: 12,
    });

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/loans' });
    expect(peticion.body).toMatchObject({
      direction: 1, // kind expense = dinero prestado; la obligación queda a favor nuestro (receivable)
      counterparty: 'persona-1',
      amount: { amount: '100000', currency: 'COP' },
      account: 'cuenta-1',
      product: 1,
      monthlyRate: 0.01,
      termMonths: 12,
    });

    const creado = store.data().movements[0];
    expect(creado).toMatchObject({
      id: 'pata-deuda',
      person: 'Camilo',
      ownership: 'loaned',
      kind: 'expense',
      amount: -100000,
      installmentTotal: 12,
      installmentCurrent: 1,
      purchaseApr: 12.683, // 1 % mensual anualizado por el comando, del cuerpo del input
    });
    expect(store.form()).toBeNull();
  });

  it('préstamo sin contraparte se rechaza sin tocar el transport', async () => {
    const transport = new TransportFalso();
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({ movements: [], people: [] }),
      transport,
    });
    cambios();
    await expect(
      component.comandos.asentar({
        tipo: 'prestamo',
        sentido: 'otorgado',
        fecha: '2026-10-01',
        descripcion: 'Préstamo',
        cuentaId: 'cuenta-1',
        contraparteId: '',
        monto: 100000,
      }),
    ).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
    expect(store.data().movements).toHaveLength(0);
  });
});

describe('MovementCommands.asentar — edición/reclasificación', () => {
  function editor() {
    const transport = new TransportFalso().responder('PUT /api/v1/movements/mov-1/classification', {
      body: apiMovement({ id: 'mov-1', description: 'Súper del agro' }),
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({
        movements: [
          {
            id: 'mov-1',
            date: '2026-09-25',
            description: 'Mercado del sábado',
            accountId: 'cuenta-1',
            category: 'Mercado',
            kind: 'expense',
            amount: -45900,
            status: 'confirmed',
            person: 'Camilo',
            recurring: true,
            purchaseApr: 3.5,
          },
        ],
      }),
      transport,
    });
    cambios();
    envenenarListado(store);
    return { transport, store, comandos: component.comandos };
  }

  it('reclasificación: envía id de categoría y descripción, y reemplaza solo lo tocado', async () => {
    const { transport, store, comandos } = editor();

    await comandos.asentar({
      tipo: 'reclasificacion',
      movimientoId: 'mov-1',
      categoria: 'Mercado',
      descripcion: 'Súper del agro',
    });

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'PUT', path: '/api/v1/movements/mov-1/classification' });
    expect(peticion.body).toEqual({ category: 'categoria-1', description: 'Súper del agro' });

    const editado = store.data().movements.find((m) => m.id === 'mov-1');
    expect(editado).toMatchObject({ description: 'Súper del agro' });
    expect(editado).toMatchObject({
      amount: -45900,
      accountId: 'cuenta-1',
      person: 'Camilo',
      recurring: true,
      purchaseApr: 3.5,
    });
    expect(store.form()).toBeNull();
  });

  it('categoría desconocida: envía null y no inventa categoría', async () => {
    const { transport, store, comandos } = editor();

    await comandos.asentar({
      tipo: 'reclasificacion',
      movimientoId: 'mov-1',
      categoria: 'Categoría inexistente',
      descripcion: 'Sin clasificar',
    });

    expect(transport.peticiones[0].body).toEqual({ category: null, description: 'Sin clasificar' });
    expect(store.data().movements.find((m) => m.id === 'mov-1')).toMatchObject({ category: 'Categoría inexistente' });
  });
});

describe('MovementCommands.asentar — corrección de monto, fecha o cuenta', () => {
  function corrector(extra: Record<string, unknown> = {}) {
    const transport = new TransportFalso().responder('POST /api/v1/movements/mov-1/correction', {
      body: apiMovement({
        id: 'mov-2',
        date: '2026-09-26',
        amount: {
          original: { amount: '99000', currency: 'COP' },
          base: { amount: '99000', currency: 'COP' },
          rate: '1',
          rateAsOf: '2026-09-26',
        },
      }),
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({
        movements: [
          {
            id: 'mov-1',
            date: '2026-09-25',
            description: 'Mercado del sábado',
            accountId: 'cuenta-1',
            category: 'Mercado',
            kind: 'expense',
            amount: -45900,
            status: 'confirmed',
            ...extra,
          },
        ],
      }),
      transport,
    });
    cambios();
    return { transport, store, comandos: component.comandos };
  }

  it('cambiar el monto pide la corrección atómica y reemplaza el original por el nuevo', async () => {
    const { transport, store, comandos } = corrector();
    store.inspect('movement', 'mov-1');

    await comandos.asentar({
      tipo: 'correccion',
      originalId: 'mov-1',
      reemplazo: {
        tipo: 'gasto',
        fecha: '2026-09-26',
        descripcion: 'Mercado del sábado',
        cuentaId: 'cuenta-1',
        monto: 99000,
        categoria: 'Mercado',
        recurrente: false,
      },
    });

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/movements/mov-1/correction' });
    expect(peticion.body).toMatchObject({
      replacement: { date: '2026-09-26', amount: { amount: '99000' }, links: { account: 'cuenta-1' } },
    });
    expect(store.data().movements.map((m) => m.id)).toEqual(['mov-2']);
    expect(store.inspector()).toMatchObject({ type: 'movement', id: 'mov-2' });
    expect(store.form()).toBeNull();
  });

  it('una pata de transferencia no se corrige y no llama a la API', async () => {
    const { transport, comandos } = corrector({ movementSubtype: 'transfer' });

    await expect(
      comandos.asentar({
        tipo: 'correccion',
        originalId: 'mov-1',
        reemplazo: {
          tipo: 'gasto',
          fecha: '2026-09-25',
          descripcion: 'Mercado del sábado',
          cuentaId: 'cuenta-1',
          monto: 10,
          categoria: 'Mercado',
          recurrente: false,
        },
      }),
    ).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });
});

describe('MovementCommands.asentar — compras de terceros y tarjeta prestada', () => {
  const prestamoRespuesta = (id: string, movements: readonly ApiMovement[]) => ({
    body: {
      obligation: { id: 'obligacion-1', counterparty: { id: 'persona-1', name: 'Camilo' }, dueOn: null },
      terms: { product: 0, monthlyRate: null, termMonths: null, cardMode: null, borrowedCard: id === 'prestada' },
      movements,
    },
  });

  it('una compra con tarjeta a nombre de otra persona se reparte entera a esa persona', async () => {
    const transport = new TransportFalso()
      .responder('POST /api/v1/movements', {
        body: apiMovement({
          id: 'compra-1',
          amount: montoDe('90000'),
          links: { card: 'tarjeta-1', counterparty: 'persona-1' },
          linkNames: { counterparty: { id: 'persona-1', name: 'Camilo' } },
        }),
      })
      .responder('POST /api/v1/shared-purchases', { body: {} });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, limit: 5000000 },
        ],
      }),
      transport,
    });
    cambios();

    await component.comandos.asentar({
      tipo: 'compraParaTercero',
      fecha: '2026-10-28',
      descripcion: 'Compra para Camilo',
      cuentaId: 'tarjeta-1',
      monto: 90000,
      categoria: 'Mercado',
      recurrente: false,
      terceroId: 'persona-1',
    });

    const [compra, reparto] = transport.peticiones;
    expect(compra).toMatchObject({ method: 'POST', path: '/api/v1/movements' });
    expect(reparto).toMatchObject({ method: 'POST', path: '/api/v1/shared-purchases' });
    expect(reparto.body).toMatchObject({
      purchaseMovement: 'compra-1',
      shares: [{ counterparty: 'persona-1', basis: 1 }],
    });
    expect(store.data().movements[0]).toMatchObject({ id: 'compra-1', person: 'Camilo', ownership: 'loaned' });
  });

  it('un gasto desde una cuenta a nombre de otra persona queda como préstamo a cobrar', async () => {
    const transport = new TransportFalso().responder(
      'POST /api/v1/loans',
      prestamoRespuesta('cuenta', [
        apiMovement({
          id: 'pata-cuenta',
          kind: MovementKind.loanDisbursement,
          effect: EconomicEffect.neutral,
          amount: montoDe('40000'),
          links: { account: 'cuenta-1', counterparty: 'persona-1' },
          linkNames: { counterparty: { id: 'persona-1', name: 'Camilo' } },
        }),
      ]),
    );
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();

    await component.comandos.asentar({
      tipo: 'compraParaTercero',
      fecha: '2026-10-28',
      descripcion: 'Almuerzo de Camilo',
      cuentaId: 'cuenta-1',
      monto: 40000,
      categoria: 'Mercado',
      recurrente: false,
      terceroId: 'persona-1',
    });

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/loans' });
    expect(peticion.body).toMatchObject({
      direction: 1,
      counterparty: 'persona-1',
      account: 'cuenta-1',
      amount: { amount: '40000', currency: 'COP' },
      description: 'Almuerzo de Camilo',
    });
    expect(store.data().movements[0]).toMatchObject({ id: 'pata-cuenta', person: 'Camilo', loanRole: 'lent' });
  });

  it('una compra con tarjeta prestada deja la deuda con quien la prestó sin cuenta propia', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/loans', prestamoRespuesta('prestada', []));
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();
    const antes = store.data().movements.length;

    await component.comandos.asentar({
      tipo: 'tarjetaPrestada',
      fecha: '2026-10-28',
      descripcion: 'Zapatos con la tarjeta de Camilo',
      prestamistaId: 'persona-1',
      monto: 180000,
      nombreDeTarjeta: 'Mastercard Davivienda',
      plazoMeses: 6,
      tasaMensual: 2,
    });

    const [peticion] = transport.peticiones;
    expect(peticion).toMatchObject({ method: 'POST', path: '/api/v1/loans' });
    expect(peticion.body).toMatchObject({
      direction: 2,
      counterparty: 'persona-1',
      amount: { amount: '180000', currency: 'COP' },
      borrowedCard: true,
      borrowedCardName: 'Mastercard Davivienda',
      termMonths: 6,
      monthlyRate: 0.02,
    });
    expect(peticion.body).not.toHaveProperty('account');
    expect(peticion.body).not.toHaveProperty('card');
    expect(store.data().movements).toHaveLength(antes);
    expect(store.form()).toBeNull();
  });
});

describe('MovementCommands.asentar — validaciones de negocio', () => {
  it('rechaza monto no positivo, cuenta ausente y transferencia sin destino, sin pedir nada a la API', async () => {
    const transport = new TransportFalso();
    const { component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();
    await expect(
      component.comandos.asentar({
        tipo: 'gasto',
        fecha: '2026-10-01',
        descripcion: 'Raro',
        cuentaId: 'cuenta-2',
        monto: 0,
        categoria: '',
        recurrente: false,
      }),
    ).rejects.toThrow();
    await expect(
      component.comandos.asentar({
        tipo: 'gasto',
        fecha: '2026-10-01',
        descripcion: 'Raro',
        cuentaId: 'cuenta-fantasma',
        monto: 100,
        categoria: '',
        recurrente: false,
      }),
    ).rejects.toThrow();
    await expect(
      component.comandos.asentar({
        tipo: 'transferencia',
        fecha: '2026-10-01',
        descripcion: 'Mismo destino',
        origenId: 'cuenta-1',
        destinoId: 'cuenta-1',
        monto: 100,
      }),
    ).rejects.toThrow();
    expect(transport.peticiones).toHaveLength(0);
  });
});

describe('MovementCommands.asentar — invalidación del listado remoto', () => {
  interface OpcionesValidacion {
    transport: TransportFalso;
    data?: ModeloDeDatos;
    comando: (comandos: MovementCommands) => Promise<void>;
  }

  async function esperarValidacionInvalidacion({
    transport,
    data = datosDe(),
    comando,
  }: OpcionesValidacion): Promise<void> {
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data,
      transport,
    });
    cambios();
    envenenarListado(store);
    await comando(component.comandos);
    expect(store.movimientosListos()).toBe(false);
    expect(store.remoteMovementPage()).toBe(1);
    expect(store.remoteMovementTotal()).toBe(0);
    expect(store.remoteMovementCursor()).toBeNull();
    expect(store.remoteMovementTotals()).toBeNull();
  }

  it('tras un alta simple exitosa, página/total/cursor y totales vuelven a cero para forzar recarga', async () => {
    await esperarValidacionInvalidacion({
      transport: new TransportFalso().responder('POST /api/v1/movements', {
        body: apiMovement({ id: 'mov-simple', links: { account: 'cuenta-2' } }),
      }),
      comando: (comandos) =>
        comandos.asentar({
          tipo: 'gasto',
          fecha: '2026-10-01',
          descripcion: 'Almuerzo',
          cuentaId: 'cuenta-2',
          monto: 45900,
          categoria: 'Mercado',
          recurrente: false,
        }),
    });
  });

  it('tras una compra con tarjeta exitosa, página/total/cursor y totales vuelven a cero para forzar recarga', async () => {
    await esperarValidacionInvalidacion({
      transport: new TransportFalso().responder('POST /api/v1/movements', {
        body: apiMovement({ id: 'mov-tarjeta', links: { card: 'tarjeta-1' } }),
      }),
      data: datosDe({
        accounts: [
          { id: 'tarjeta-1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0, limit: 5000000 },
        ],
        people: [],
      }),
      comando: (comandos) =>
        comandos.asentar({
          tipo: 'gasto',
          fecha: '2026-10-01',
          descripcion: 'Nevera',
          cuentaId: 'tarjeta-1',
          monto: 45900,
          categoria: 'Mercado',
          recurrente: false,
        }),
    });
  });

  it('tras un préstamo exitoso, página/total/cursor y totales vuelven a cero para forzar recarga', async () => {
    await esperarValidacionInvalidacion({
      transport: new TransportFalso().responder('POST /api/v1/loans', {
        body: {
          obligation: { id: 'obligacion-1', counterparty: { id: 'persona-1', name: 'Camilo' }, dueOn: null },
          terms: { product: 0, monthlyRate: null, termMonths: null, cardMode: null },
          movements: [apiMovement({ id: 'pata-deuda', flow: CashFlow.outflow, amount: montoDe('100000') })],
        },
      }),
      data: datosDe({ movements: [], people: [{ id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 }] }),
      comando: (comandos) =>
        comandos.asentar({
          tipo: 'prestamo',
          sentido: 'otorgado',
          fecha: '2026-10-01',
          descripcion: 'Préstamo',
          cuentaId: 'cuenta-1',
          contraparteId: 'persona-1',
          monto: 100000,
          producto: 'personal',
        }),
    });
  });

  it('un comando que falla no invalida el listado remoto', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements', {
      error: { status: 409, code: 'movement.conflict' },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();
    envenenarListado(store);

    await expect(
      component.comandos.asentar({
        tipo: 'gasto',
        fecha: '2026-10-01',
        descripcion: 'Conflicto',
        cuentaId: 'cuenta-1',
        monto: 1000,
        categoria: 'Mercado',
        recurrente: false,
      }),
    ).rejects.toThrow();

    expect(store.movimientosListos()).toBe(true);
    expect(store.remoteMovementPage()).toBe(3);
    expect(store.remoteMovementTotal()).toBe(42);
    expect(store.remoteMovementCursor()).toBe('cursor-7');
  });
});

describe('MovementCommands.asentar — transporte con errores (4xx / 5xx)', () => {
  it('createMovement 409: sin copia optimista ni mutación del store; el reintento no duplica', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements', {
      error: { status: 409, code: 'movement.conflict' },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();
    const antes = store.data().movements;

    await expect(
      component.comandos.asentar({
        tipo: 'gasto',
        fecha: '2026-10-01',
        descripcion: 'Conflicto',
        cuentaId: 'cuenta-1',
        monto: 1000,
        categoria: 'Mercado',
        recurrente: false,
      }),
    ).rejects.toThrow();
    expect(store.data().movements).toEqual(antes);

    transport.limpiar();
    transport.responder('POST /api/v1/movements', {
      body: apiMovement({ id: 'mov-nuevo', links: { account: 'cuenta-1' } }),
    });
    await component.comandos.asentar({
      tipo: 'gasto',
      fecha: '2026-10-01',
      descripcion: 'Reintento',
      cuentaId: 'cuenta-1',
      monto: 1000,
      categoria: 'Mercado',
      recurrente: false,
    });
    const ids = store.data().movements.map((m) => m.id);
    expect(ids.filter((id) => id === 'mov-nuevo')).toHaveLength(1);
  });

  it('transfer 500: no queda media transferencia (ninguna pata se agrega)', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/operations/transfers', {
      error: { status: 500, code: 'internal.error' },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe({ movements: [] }),
      transport,
    });
    cambios();
    envenenarListado(store);
    const antes = store.data().movements;

    await expect(
      component.comandos.asentar({
        tipo: 'transferencia',
        fecha: '2026-10-01',
        descripcion: 'Fallida',
        origenId: 'cuenta-1',
        destinoId: 'cuenta-2',
        monto: 700,
      }),
    ).rejects.toThrow();

    expect(store.data().movements).toEqual(antes);
    // el listado remoto queda intacto: la invalidación solo aplica si el comando salió bien
    expect(store.movimientosListos()).toBe(true);
    expect(store.remoteMovementPage()).toBe(3);
    expect(store.remoteMovementTotal()).toBe(42);
    expect(store.remoteMovementCursor()).toBe('cursor-7');
    expect(store.remoteMovementTotals()).toEqual({ income: 500, expense: 300 });
  });

  it('form no se cierra tras fallar el envío: queda como estaba antes del intento', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/movements', {
      error: { status: 500, code: 'internal.error' },
    });
    const { store, component, cambios } = pruebaRender(ComponenteVacio, {
      session: sesionDe().conTodosLosPermisos(),
      data: datosDe(),
      transport,
    });
    cambios();
    store.form.set({ kind: 'expense' });

    await expect(
      component.comandos.asentar({
        tipo: 'gasto',
        fecha: '2026-10-01',
        descripcion: 'Fallida',
        cuentaId: 'cuenta-1',
        monto: 1000,
        categoria: 'Mercado',
        recurrente: false,
      }),
    ).rejects.toThrow();

    expect(store.form()).toEqual({ kind: 'expense' });
  });
});
