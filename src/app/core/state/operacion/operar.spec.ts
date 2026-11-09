import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { CashFlow, EconomicEffect, MovementKind, signOf } from '@core/utils/movement-kinds';
import type { Account, Movement, Person } from '../view-model';
import type { IntencionDeMovimiento } from './intencion';
import { type EntornoDeOperacion, operar } from './operar';

const efectivo: Account = { id: 'efectivo', name: 'Efectivo', type: 'cash', currency: 'COP', openingBalance: 0 };
const ahorros: Account = { id: 'ahorros', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 };
const visa: Account = {
  id: 'visa',
  name: 'Visa',
  type: 'credit',
  currency: 'COP',
  openingBalance: 0,
  limit: 5_000_000,
};
const camilo: Person = { id: 'camilo', name: 'Camilo', owed: 0, owing: 0 };

const original: Movement = {
  id: 'mov-1',
  date: '2026-10-01',
  description: 'Mercado',
  accountId: 'efectivo',
  category: 'Mercado',
  kind: 'expense',
  amount: -1000,
  status: 'confirmed',
};

function entorno(
  sobre: Partial<{ permisos: readonly string[] | 'todos'; movimientos: Movement[] }> = {},
): EntornoDeOperacion {
  const permisos = sobre.permisos ?? 'todos';
  const cuentas = [efectivo, ahorros, visa];
  return {
    cuenta: (id) => cuentas.find((c) => c.id === id),
    persona: (id) => [camilo].find((p) => p.id === id),
    categoria: (nombre) => (nombre === 'Mercado' ? { id: 'cat-1' } : undefined),
    movimiento: (id) => (sobre.movimientos ?? [original]).find((m) => m.id === id),
    permite: (permiso) => permisos === 'todos' || permisos.includes(permiso),
    monedaBase: 'COP',
    nuevaClave: () => 'clave-1',
    claveDeOperacion: (huella) => `compartida:${huella}`,
  };
}

const gasto = (sobre: Record<string, unknown> = {}): IntencionDeMovimiento =>
  ({
    tipo: 'gasto',
    fecha: '2026-10-01',
    descripcion: 'Almuerzo',
    cuentaId: 'efectivo',
    monto: 45_900,
    categoria: 'Mercado',
    recurrente: false,
    ...sobre,
  }) as IntencionDeMovimiento;

function solicitudDe(intencion: IntencionDeMovimiento, env = entorno()) {
  const resultado = operar(intencion, env);
  if (!resultado.ok) throw new Error(`error inesperado ${resultado.error.codigo}`);
  return resultado.solicitud;
}

function errorDe(intencion: IntencionDeMovimiento, env = entorno()) {
  const resultado = operar(intencion, env);
  if (resultado.ok) throw new Error('se esperaba un error');
  return resultado.error.codigo;
}

describe('operar gasto', () => {
  it('permitido: salida de efectivo con efecto gasto y signo negativo', () => {
    const solicitud = solicitudDe(gasto());
    if (solicitud.via !== 'movimiento') throw new Error('via');
    expect(solicitud.cuerpo).toMatchObject({
      kind: MovementKind.expense,
      effect: EconomicEffect.expense,
      flow: CashFlow.outflow,
      amount: { amount: '45900', currency: 'COP' },
      links: { account: 'efectivo', category: 'cat-1' },
      idempotencyKey: 'clave-1',
    });
    expect(signOf(solicitud.cuerpo.flow, solicitud.cuerpo.effect)).toBe(-1);
    expect(solicitud.presentacion.propiedad).toBeUndefined();
  });

  it('con tarjeta: compra de tarjeta con cuotas y tasa anual propia', () => {
    const solicitud = solicitudDe(gasto({ cuentaId: 'visa', cuotas: 6, tasaDeCuota: 1, balde: 3 }));
    if (solicitud.via !== 'movimiento') throw new Error('via');
    expect(solicitud.cuerpo).toMatchObject({
      kind: MovementKind.cardPurchase,
      links: { card: 'visa', category: 'cat-1' },
      installments: 6,
      purchaseApr: 12.683,
      cardBucket: 3,
    });
  });

  it('en dolares envia el monto original y la tasa', () => {
    const solicitud = solicitudDe(gasto({ enDolares: { monto: 10, tasa: 4000 } }));
    if (solicitud.via !== 'movimiento') throw new Error('via');
    expect(solicitud.cuerpo).toMatchObject({
      amount: { amount: '10', currency: 'USD' },
      rate: '4000',
      rateAsOf: '2026-10-01',
    });
  });

  it('no permitido: sin permiso de crear', () => {
    expect(errorDe(gasto(), entorno({ permisos: [] }))).toBe('sin_permiso');
  });

  it('no permitido: en dolares sin tasa vigente o sin monto original', () => {
    expect(errorDe(gasto({ enDolares: { monto: 10, tasa: 0 } }))).toBe('tasa_de_cambio_invalida');
    expect(errorDe(gasto({ enDolares: { monto: 0, tasa: 4000 } }))).toBe('monto_invalido');
  });

  it('no permitido: compra con tarjeta sin permiso de creditos', () => {
    expect(errorDe(gasto({ cuentaId: 'visa' }), entorno({ permisos: [P.movimientos.crear] }))).toBe(
      'compra_con_tarjeta_prohibida',
    );
  });

  it('rechaza monto no positivo y cuenta inexistente', () => {
    expect(errorDe(gasto({ monto: 0 }))).toBe('monto_invalido');
    expect(errorDe(gasto({ monto: Number.NaN }))).toBe('monto_invalido');
    expect(errorDe(gasto({ cuentaId: 'fantasma' }))).toBe('cuenta_invalida');
  });
});

describe('operar ingreso', () => {
  const ingreso = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'ingreso',
      fecha: '2026-10-01',
      descripcion: 'Salario',
      cuentaId: 'ahorros',
      monto: 3_000_000,
      categoria: '',
      recurrente: false,
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: entrada con efecto ingreso y signo positivo; la contraparte queda enlazada', () => {
    const solicitud = solicitudDe(ingreso({ contraparteId: 'camilo' }));
    if (solicitud.via !== 'movimiento') throw new Error('via');
    expect(solicitud.cuerpo).toMatchObject({
      kind: MovementKind.income,
      effect: EconomicEffect.income,
      flow: CashFlow.inflow,
      links: { account: 'ahorros', counterparty: 'camilo' },
    });
    expect(signOf(solicitud.cuerpo.flow, solicitud.cuerpo.effect)).toBe(1);
  });

  it('no permitido: recibido de alguien exige una contraparte conocida', () => {
    expect(errorDe(ingreso({ exigeContraparte: true }))).toBe('contraparte_requerida');
    expect(errorDe(ingreso({ exigeContraparte: true, contraparteId: 'fantasma' }))).toBe('contraparte_requerida');
    expect(solicitudDe(ingreso({ exigeContraparte: true, contraparteId: 'camilo' })).via).toBe('movimiento');
  });

  it('no permitido: sin permiso y sobre una tarjeta', () => {
    expect(errorDe(ingreso(), entorno({ permisos: [] }))).toBe('sin_permiso');
    expect(errorDe(ingreso({ cuentaId: 'visa' }))).toBe('ingreso_en_tarjeta');
  });
});

describe('operar transferencia', () => {
  const transferencia = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'transferencia',
      fecha: '2026-10-01',
      descripcion: 'Mover',
      origenId: 'ahorros',
      destinoId: 'efectivo',
      monto: 50_000,
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: pide una operacion de dos patas con la moneda de la cuenta origen', () => {
    expect(solicitudDe(transferencia())).toMatchObject({
      via: 'transferencia',
      cuerpo: {
        amount: { amount: '50000', currency: 'COP' },
        sourceAccount: 'ahorros',
        destinationAccount: 'efectivo',
        idempotencyKey: 'clave-1',
      },
    });
  });

  it('no permitido: sin permiso, mismo destino, destino inexistente o con tarjeta', () => {
    expect(errorDe(transferencia(), entorno({ permisos: [P.movimientos.crear] }))).toBe('sin_permiso');
    expect(errorDe(transferencia({ destinoId: 'ahorros' }))).toBe('destino_invalido');
    expect(errorDe(transferencia({ destinoId: 'fantasma' }))).toBe('destino_invalido');
    expect(errorDe(transferencia({ destinoId: 'visa' }))).toBe('transferencia_con_tarjeta');
    expect(errorDe(transferencia({ monto: -1 }))).toBe('monto_invalido');
  });
});

describe('operar avance', () => {
  const avance = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'avance',
      fecha: '2026-10-01',
      descripcion: 'Avance',
      tarjetaId: 'visa',
      destinoId: 'ahorros',
      monto: 200_000,
      cuotas: 12,
      tasaDeCuota: 2,
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: tarjeta origen, cuenta destino, cuotas y tasa anual', () => {
    expect(solicitudDe(avance())).toMatchObject({
      via: 'avance',
      cuerpo: { card: 'visa', account: 'ahorros', installments: 12, apr: 26.824 },
    });
  });

  it('una sola cuota no se envia', () => {
    const solicitud = solicitudDe(avance({ cuotas: 1 }));
    if (solicitud.via !== 'avance') throw new Error('via');
    expect(solicitud.cuerpo.installments).toBeUndefined();
    expect(solicitud.cuerpo.apr).toBeUndefined();
  });

  it('no permitido: sin permiso, origen que no es tarjeta o destino tarjeta', () => {
    expect(errorDe(avance(), entorno({ permisos: [P.movimientos.crear] }))).toBe('sin_permiso');
    expect(errorDe(avance({ tarjetaId: 'ahorros' }))).toBe('avance_con_cuentas_invalidas');
    expect(errorDe(avance({ destinoId: 'visa' }))).toBe('avance_con_cuentas_invalidas');
  });
});

describe('operar pago de tarjeta', () => {
  const pago = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'pagoDeTarjeta',
      fecha: '2026-10-01',
      descripcion: 'Abono',
      origenId: 'ahorros',
      tarjetaId: 'visa',
      monto: 100_000,
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: cuenta que paga y tarjeta pagada', () => {
    expect(solicitudDe(pago())).toMatchObject({
      via: 'pagoDeTarjeta',
      cuerpo: { account: 'ahorros', card: 'visa', amount: { amount: '100000', currency: 'COP' } },
    });
  });

  it('no permitido: sin permiso o cuentas inexistentes', () => {
    expect(errorDe(pago(), entorno({ permisos: [P.movimientos.crear] }))).toBe('sin_permiso');
    expect(errorDe(pago({ tarjetaId: 'fantasma' }))).toBe('destino_invalido');
    expect(errorDe(pago({ origenId: 'fantasma' }))).toBe('cuenta_invalida');
  });
});

describe('operar préstamo', () => {
  const prestamo = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'prestamo',
      sentido: 'otorgado',
      fecha: '2026-10-01',
      descripcion: 'Préstamo',
      cuentaId: 'ahorros',
      contraparteId: 'camilo',
      monto: 100_000,
      ...sobre,
    }) as IntencionDeMovimiento;

  it('otorgado: la obligacion queda por cobrar y sale dinero de la cuenta', () => {
    expect(solicitudDe(prestamo({ tasaMensual: 1, plazoMeses: 12, producto: 'personal' }))).toMatchObject({
      via: 'prestamo',
      cuerpo: {
        direction: 1,
        counterparty: 'camilo',
        account: 'ahorros',
        product: 1,
        monthlyRate: 0.01,
        termMonths: 12,
      },
      presentacion: { propiedad: 'loaned', plazoMeses: 12, aprAnual: 12.683, producto: 'personal' },
    });
  });

  it('recibido: la obligacion queda por pagar', () => {
    expect(solicitudDe(prestamo({ sentido: 'recibido' }))).toMatchObject({ cuerpo: { direction: 2 } });
  });

  it('con tarjeta usa el modo de la tarjeta', () => {
    expect(solicitudDe(prestamo({ cuentaId: 'visa', modoDeTarjeta: 'cashAdvance' }))).toMatchObject({
      cuerpo: { card: 'visa', cardMode: 2 },
    });
  });

  it('un credito con producto exige el permiso de creditos', () => {
    const sinCreditos = entorno({ permisos: [P.movimientos.prestamos.crear] });
    expect(errorDe(prestamo({ producto: 'mortgage' }), sinCreditos)).toBe('sin_permiso');
    expect(solicitudDe(prestamo(), sinCreditos).via).toBe('prestamo');
  });

  it('no permitido: sin contraparte, tasa fuera de rango, recibido sobre tarjeta', () => {
    expect(errorDe(prestamo({ contraparteId: 'fantasma' }))).toBe('contraparte_requerida');
    expect(errorDe(prestamo({ tasaMensual: 101 }))).toBe('tasa_invalida');
    expect(errorDe(prestamo({ tasaMensual: -1 }))).toBe('tasa_invalida');
    expect(errorDe(prestamo({ sentido: 'recibido', cuentaId: 'visa' }))).toBe('ingreso_en_tarjeta');
    expect(errorDe(prestamo(), entorno({ permisos: [] }))).toBe('sin_permiso');
  });
});

describe('operar compra para tercero', () => {
  const compra = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'compraParaTercero',
      fecha: '2026-10-28',
      descripcion: 'Compra para Camilo',
      cuentaId: 'visa',
      monto: 90_000,
      categoria: 'Mercado',
      recurrente: false,
      terceroId: 'camilo',
      ...sobre,
    }) as IntencionDeMovimiento;

  it('con tarjeta: operacion atomica con la compra enlazada al tercero, reparto completo y propiedad prestada', () => {
    const solicitud = solicitudDe(compra());
    if (solicitud.via !== 'compraCompartida') throw new Error('via');
    expect(solicitud.cuerpo.links).toMatchObject({ card: 'visa', counterparty: 'camilo' });
    expect(solicitud.reparto).toEqual({ terceroId: 'camilo', descripcion: 'Compra para Camilo' });
    expect(solicitud.presentacion.propiedad).toBe('loaned');
    expect(signOf(solicitud.cuerpo.flow, solicitud.cuerpo.effect)).toBe(-1);
  });

  it('la clave de la operacion sale de una huella que cambia con monto o reparto y no con lo demas', () => {
    const claveDe = (sobre = {}) => {
      const solicitud = solicitudDe(compra(sobre));
      if (solicitud.via !== 'compraCompartida') throw new Error('via');
      return solicitud.cuerpo.idempotencyKey;
    };
    expect(claveDe()).toBe(claveDe());
    expect(claveDe({ monto: 91_000 })).not.toBe(claveDe());
  });

  it('con una cuenta propia queda como prestamo por cobrar', () => {
    expect(solicitudDe(compra({ cuentaId: 'ahorros' }))).toMatchObject({
      via: 'prestamo',
      cuerpo: { direction: 1, counterparty: 'camilo', account: 'ahorros', description: 'Compra para Camilo' },
      presentacion: { propiedad: 'loaned' },
    });
  });

  it('no permitido: tercero inexistente o tarjeta sin permiso de creditos', () => {
    expect(errorDe(compra({ terceroId: 'fantasma' }))).toBe('contraparte_requerida');
    expect(errorDe(compra(), entorno({ permisos: [P.movimientos.crear] }))).toBe('compra_con_tarjeta_prohibida');
  });
});

describe('operar tarjeta prestada', () => {
  const prestada = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'tarjetaPrestada',
      fecha: '2026-10-28',
      descripcion: 'Zapatos',
      prestamistaId: 'camilo',
      monto: 180_000,
      nombreDeTarjeta: ' Mastercard ',
      plazoMeses: 6,
      tasaMensual: 2,
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: deuda con quien presto la tarjeta, sin cuenta propia', () => {
    const solicitud = solicitudDe(prestada());
    if (solicitud.via !== 'tarjetaPrestada') throw new Error('via');
    expect(solicitud.cuerpo).toMatchObject({
      direction: 2,
      counterparty: 'camilo',
      borrowedCard: true,
      borrowedCardName: 'Mastercard',
      termMonths: 6,
      monthlyRate: 0.02,
      amount: { amount: '180000', currency: 'COP' },
    });
    expect(solicitud.cuerpo).not.toHaveProperty('account');
    expect(solicitud.cuerpo).not.toHaveProperty('card');
  });

  it('no permitido: sin permiso o sin prestamista', () => {
    expect(errorDe(prestada(), entorno({ permisos: [P.movimientos.crear] }))).toBe('sin_permiso');
    expect(errorDe(prestada({ prestamistaId: 'fantasma' }))).toBe('contraparte_requerida');
  });
});

describe('operar corrección', () => {
  const correccion = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'correccion',
      originalId: 'mov-1',
      reemplazo: {
        tipo: 'gasto',
        fecha: '2026-10-02',
        descripcion: 'Mercado',
        cuentaId: 'efectivo',
        monto: 2000,
        categoria: 'Mercado',
        recurrente: false,
      },
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: reemplaza el original con el cuerpo nuevo', () => {
    expect(solicitudDe(correccion())).toMatchObject({
      via: 'correccion',
      originalId: 'mov-1',
      cuerpo: { amount: { amount: '2000', currency: 'COP' }, flow: CashFlow.outflow },
    });
  });

  it('no permitido: una pata de transferencia, un pago o un prestamo no se corrigen', () => {
    for (const movimiento of [
      { ...original, movementSubtype: 'transfer' as const },
      { ...original, kind: 'payment' as const },
      { ...original, loanRole: 'lent' as const },
    ])
      expect(errorDe(correccion(), entorno({ movimientos: [movimiento] }))).toBe('no_corregible');
  });

  it('no permitido: sin permiso de editar u original desconocido', () => {
    expect(errorDe(correccion(), entorno({ permisos: [P.movimientos.crear] }))).toBe('sin_permiso');
    expect(errorDe(correccion({ originalId: 'otro' }))).toBe('no_corregible');
  });
});

describe('operar reclasificación', () => {
  const reclasificacion = (sobre = {}): IntencionDeMovimiento =>
    ({
      tipo: 'reclasificacion',
      movimientoId: 'mov-1',
      categoria: 'Mercado',
      descripcion: 'Nueva',
      ...sobre,
    }) as IntencionDeMovimiento;

  it('permitido: envia id de categoria y descripcion, sin tocar el monto', () => {
    expect(solicitudDe(reclasificacion())).toMatchObject({
      via: 'reclasificacion',
      movimientoId: 'mov-1',
      cuerpo: { category: 'cat-1', description: 'Nueva' },
    });
  });

  it('categoria desconocida o descripcion vacia envian null', () => {
    expect(solicitudDe(reclasificacion({ categoria: 'Inventada', descripcion: '' }))).toMatchObject({
      cuerpo: { category: null, description: null },
    });
  });

  it('no permitido: sin permiso de editar', () => {
    expect(errorDe(reclasificacion(), entorno({ permisos: [] }))).toBe('sin_permiso');
  });
});
