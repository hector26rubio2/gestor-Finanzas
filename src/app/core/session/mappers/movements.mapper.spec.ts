import { describe, expect, it } from 'vitest';
import type { ApiMovement } from '@core/api/ledger.api';
import { I18nService } from '@core/i18n';
import { CashFlow, EconomicEffect, EMPTY_KIND_CATALOG, MovementKind } from '@core/utils/movement-kinds';
import { signoDeMovimiento, toMovement } from './movements.mapper';

const dinero = (cantidad: string) => ({
  original: { amount: cantidad, currency: 'COP' },
  base: { amount: cantidad, currency: 'COP' },
  rate: '1',
  rateAsOf: '2026-09-25',
});

function api(sobre: Partial<ApiMovement> = {}): ApiMovement {
  return {
    id: 'm1',
    date: '2026-09-25',
    kind: MovementKind.expense,
    effect: EconomicEffect.expense,
    flow: CashFlow.outflow,
    amount: dinero('1000'),
    links: { account: 'cuenta-1' },
    linkNames: {},
    origin: 0,
    description: null,
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...sobre,
  } as ApiMovement;
}

describe('signoDeMovimiento', () => {
  it('la salida de dinero resta y la entrada suma', () => {
    expect(signoDeMovimiento(api())).toBe(-1);
    expect(signoDeMovimiento(api({ flow: CashFlow.inflow, effect: EconomicEffect.income }))).toBe(1);
  });

  it('un gasto sin flujo de caja resta; un neutro sin flujo suma', () => {
    expect(signoDeMovimiento(api({ flow: CashFlow.none }))).toBe(-1);
    expect(signoDeMovimiento(api({ flow: CashFlow.none, effect: EconomicEffect.neutral }))).toBe(1);
  });

  it('un reverso invierte el signo del movimiento que anula', () => {
    expect(signoDeMovimiento(api({ reversalOf: 'original' }))).toBe(1);
    expect(signoDeMovimiento(api({ flow: CashFlow.inflow, effect: EconomicEffect.income, reversalOf: 'x' }))).toBe(-1);
  });
});

describe('toMovement con opciones de presentación', () => {
  const i18n = new I18nService();

  it('usa la descripción y la categoría de la opción cuando el servidor no las trae', () => {
    const movimiento = toMovement(i18n, EMPTY_KIND_CATALOG, api(), { descripcion: 'Almuerzo', categoria: 'Mercado' });
    expect(movimiento).toMatchObject({ description: 'Almuerzo', category: 'Mercado', amount: -1000 });
  });

  it('el servidor manda sobre las opciones', () => {
    const movimiento = toMovement(
      i18n,
      EMPTY_KIND_CATALOG,
      api({ description: 'Del servidor', linkNames: { category: { id: 'c', name: 'Ocio' } } }),
      { descripcion: 'Local', categoria: 'Mercado' },
    );
    expect(movimiento).toMatchObject({ description: 'Del servidor', category: 'Ocio' });
  });

  it('propiedad, persona, recurrencia y préstamo se aplican desde las opciones', () => {
    const movimiento = toMovement(i18n, EMPTY_KIND_CATALOG, api(), {
      propiedad: 'loaned',
      persona: 'Camilo',
      recurrente: true,
      producto: 'personal',
      plazoMeses: 12,
      aprAnual: 12.683,
    });
    expect(movimiento).toMatchObject({
      ownership: 'loaned',
      person: 'Camilo',
      recurring: true,
      loanProduct: 'personal',
      installmentTotal: 12,
      installmentCurrent: 1,
      purchaseApr: 12.683,
    });
  });

  it('sin opciones conserva el comportamiento del listado', () => {
    expect(toMovement(i18n, EMPTY_KIND_CATALOG, api())).toMatchObject({ ownership: 'own', recurring: false });
  });

  it('conserva el momento de registro para ubicar el movimiento por hora en el calendario', () => {
    const movimiento = toMovement(i18n, EMPTY_KIND_CATALOG, api({ createdAt: '2026-09-25T14:30:00Z' }));

    expect(movimiento.registradoEl).toBe('2026-09-25T14:30:00Z');
  });
});
