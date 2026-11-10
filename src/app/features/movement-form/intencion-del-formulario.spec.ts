import { describe, expect, it } from 'vitest';
import type { Movement, Person } from '@core/state/view-model';
import { type ContextoDelFormulario, intencionDelFormulario } from './intencion-del-formulario';
import type { MovementFormModel } from './movement-form';

const camilo: Person = { id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 };

function modelo(sobre: Partial<MovementFormModel> = {}): MovementFormModel {
  return {
    kind: 'expense',
    operationType: 'normal',
    date: '2026-10-01',
    description: 'Almuerzo',
    accountId: 'cuenta-1',
    targetId: '',
    category: 'Mercado',
    person: '',
    counterpartyId: '',
    borrowedCardName: '',
    amount: 45_900,
    ownership: 'own',
    recurring: 'false',
    recurrence: 'monthly',
    installmentCurrent: 1,
    installmentTotal: 1,
    loanProduct: 'personal',
    cardMode: 'purchase',
    originalCurrency: 'COP',
    originalAmount: 0,
    exchangeRate: 0,
    ...sobre,
  };
}

function contexto(sobre: Partial<ContextoDelFormulario> = {}): ContextoDelFormulario {
  return {
    moneda: 'COP',
    personaPorNombre: (nombre) => [camilo].find((p) => p.name === nombre),
    movimiento: () => undefined,
    ...sobre,
  };
}

const original: Movement = {
  id: 'mov-1',
  date: '2026-10-01',
  description: 'Almuerzo',
  accountId: 'cuenta-1',
  category: 'Mercado',
  kind: 'expense',
  amount: -45_900,
  status: 'confirmed',
};

describe('intencionDelFormulario', () => {
  it('gasto normal', () => {
    expect(intencionDelFormulario(modelo(), contexto())).toEqual({
      tipo: 'gasto',
      fecha: '2026-10-01',
      descripcion: 'Almuerzo',
      cuentaId: 'cuenta-1',
      monto: 45_900,
      categoria: 'Mercado',
      recurrente: false,
      cuotas: 1,
      tasaDeCuota: undefined,
      balde: undefined,
      enDolares: undefined,
    });
  });

  it('gasto en dolares lleva el monto original y la tasa', () => {
    expect(
      intencionDelFormulario(modelo({ originalAmount: 10, exchangeRate: 4000 }), contexto({ moneda: 'USD' })),
    ).toMatchObject({ tipo: 'gasto', enDolares: { monto: 10, tasa: 4000 } });
  });

  it('gasto con persona conocida es una compra para tercero', () => {
    expect(intencionDelFormulario(modelo({ person: 'Camilo' }), contexto())).toMatchObject({
      tipo: 'compraParaTercero',
      terceroId: 'persona-1',
    });
  });

  it('gasto con persona desconocida sigue siendo un gasto', () => {
    expect(intencionDelFormulario(modelo({ person: 'Nadie' }), contexto())).toMatchObject({ tipo: 'gasto' });
  });

  it('ingreso normal enlaza la persona por nombre; recibido exige contraparte', () => {
    expect(intencionDelFormulario(modelo({ kind: 'income', person: 'Camilo' }), contexto())).toMatchObject({
      tipo: 'ingreso',
      contraparteId: 'persona-1',
      exigeContraparte: false,
    });
    expect(
      intencionDelFormulario(
        modelo({ kind: 'income', operationType: 'received', counterpartyId: 'persona-1' }),
        contexto(),
      ),
    ).toMatchObject({ tipo: 'ingreso', contraparteId: 'persona-1', exigeContraparte: true });
  });

  it('transferencia, avance y prestamos', () => {
    expect(
      intencionDelFormulario(modelo({ operationType: 'transfer', accountId: 'a', targetId: 'b' }), contexto()),
    ).toMatchObject({ tipo: 'transferencia', origenId: 'a', destinoId: 'b', monto: 45_900 });
    expect(
      intencionDelFormulario(
        modelo({
          operationType: 'advance',
          accountId: 'tarjeta',
          targetId: 'b',
          installmentTotal: 12,
          installmentRate: 2,
        }),
        contexto(),
      ),
    ).toMatchObject({ tipo: 'avance', tarjetaId: 'tarjeta', destinoId: 'b', cuotas: 12, tasaDeCuota: 2 });
    expect(
      intencionDelFormulario(
        modelo({ operationType: 'loan', counterpartyId: 'persona-1', monthlyRate: 1, termMonths: 6 }),
        contexto(),
      ),
    ).toMatchObject({
      tipo: 'prestamo',
      sentido: 'otorgado',
      contraparteId: 'persona-1',
      tasaMensual: 1,
      plazoMeses: 6,
    });
    expect(
      intencionDelFormulario(
        modelo({ kind: 'income', operationType: 'credit', counterpartyId: 'persona-1', loanProduct: 'mortgage' }),
        contexto(),
      ),
    ).toMatchObject({ tipo: 'prestamo', sentido: 'recibido', producto: 'mortgage' });
  });

  it('tarjeta prestada', () => {
    expect(
      intencionDelFormulario(
        modelo({ operationType: 'borrowedCard', counterpartyId: 'persona-1', borrowedCardName: 'MC' }),
        contexto(),
      ),
    ).toMatchObject({ tipo: 'tarjetaPrestada', prestamistaId: 'persona-1', nombreDeTarjeta: 'MC' });
  });

  describe('edicion', () => {
    it('cambiar el monto es una correccion con el reemplazo', () => {
      const intencion = intencionDelFormulario(
        modelo({ id: 'mov-1', amount: 50_000 }),
        contexto({ movimiento: () => original }),
      );
      expect(intencion).toMatchObject({
        tipo: 'correccion',
        originalId: 'mov-1',
        reemplazo: { tipo: 'gasto', monto: 50_000 },
      });
    });

    it('cambiar solo categoria o descripcion es una reclasificacion', () => {
      expect(
        intencionDelFormulario(
          modelo({ id: 'mov-1', description: 'Otro', category: 'Ocio' }),
          contexto({ movimiento: () => original }),
        ),
      ).toEqual({ tipo: 'reclasificacion', movimientoId: 'mov-1', categoria: 'Ocio', descripcion: 'Otro' });
    });

    it('un movimiento desconocido se corrige para que la operacion falle en vez de guardar a medias', () => {
      expect(intencionDelFormulario(modelo({ id: 'otro', amount: 99_000 }), contexto())).toMatchObject({
        tipo: 'correccion',
        originalId: 'otro',
        reemplazo: { monto: 99_000 },
      });
    });

    it('editar solo la descripcion de una pata de transferencia es una reclasificacion', () => {
      expect(
        intencionDelFormulario(
          modelo({ id: 'mov-1', operationType: 'transfer', targetId: 'b', description: 'Nueva' }),
          contexto({ movimiento: () => ({ ...original, movementSubtype: 'transfer' }) }),
        ),
      ).toEqual({ tipo: 'reclasificacion', movimientoId: 'mov-1', categoria: 'Mercado', descripcion: 'Nueva' });
    });

    it('editar solo la categoria de un avance es una reclasificacion', () => {
      expect(
        intencionDelFormulario(
          modelo({ id: 'mov-1', operationType: 'advance', targetId: 'b', category: 'Ocio' }),
          contexto({ movimiento: () => ({ ...original, movementSubtype: 'advance' }) }),
        ),
      ).toMatchObject({ tipo: 'reclasificacion', categoria: 'Ocio' });
    });

    it('cambiar el monto de una transferencia sigue siendo correccion y la operacion la rechaza', () => {
      expect(
        intencionDelFormulario(
          modelo({ id: 'mov-1', operationType: 'transfer', targetId: 'b', amount: 1 }),
          contexto({ movimiento: () => ({ ...original, movementSubtype: 'transfer' }) }),
        ),
      ).toMatchObject({ tipo: 'correccion' });
    });
  });
});
