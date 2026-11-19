import { describe, expect, it } from 'vitest';
import { SHARE_BASIS } from '@core/api/purchases.api';
import { operacionCompartida, repartoCompleto } from './operar';

const reparto = { terceroId: 'camilo', descripcion: 'Mercado compartido' };

describe('reparto de una compra compartida', () => {
  it('compartir una compra ya hecha la reparte entera con el tercero', () => {
    expect(repartoCompleto('mov-1', reparto)).toEqual({
      purchaseMovement: 'mov-1',
      shares: [{ counterparty: 'camilo', basis: SHARE_BASIS.full }],
      description: 'Mercado compartido',
    });
  });

  it('crear la compra y repartirla va en una sola operación con el mismo reparto', () => {
    const compra = {
      date: '2026-10-28',
      kind: 20,
      effect: 2,
      flow: 2,
      amount: { amount: '90000', currency: 'COP' },
      links: { card: 'visa' },
      idempotencyKey: 'clave-1',
    } as never;

    const operacion = operacionCompartida(compra, reparto);

    expect(operacion.purchase).toBe(compra);
    expect(operacion.shares).toEqual([{ counterparty: 'camilo', basis: SHARE_BASIS.full }]);
    expect(operacion.description).toBe('Mercado compartido');
  });

  it('cada reparto es independiente: otra persona no hereda al tercero anterior', () => {
    const primero = repartoCompleto('mov-1', reparto);
    const segundo = repartoCompleto('mov-2', { terceroId: 'ana', descripcion: 'Cena' });

    expect(primero.shares[0].counterparty).toBe('camilo');
    expect(segundo.shares[0].counterparty).toBe('ana');
    expect(segundo.purchaseMovement).toBe('mov-2');
  });
});
