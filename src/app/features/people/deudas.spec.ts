import { describe, expect, it } from 'vitest';
import type { ApiObligation } from '@core/api/obligations.api';
import { comportamientoDePago, deudasDe, masAtrasado } from './deudas';

function obligacion(extra: Partial<ApiObligation> = {}): ApiObligation {
  return {
    id: 'o1',
    counterparty: { id: 'p1', name: 'Andrés' },
    direction: 2,
    currency: 'COP',
    openedOn: '2026-08-15',
    dueOn: '2027-02-15',
    description: 'Zapatos',
    status: 1,
    totalOutstanding: { amount: '200000', currency: 'COP' },
    interestPolicies: [],
    entries: [
      { type: 2, date: '2026-08-15', principalDelta: { amount: '300000', currency: 'COP' } },
      { type: 4, date: '2026-09-15', principalDelta: { amount: '-50000', currency: 'COP' } },
    ],
    terms: { product: 0, monthlyRate: 0, termMonths: 6, cardMode: null, borrowedCard: true, borrowedCardName: 'Visa' },
    ...extra,
  } as ApiObligation;
}

describe('deudasDe', () => {
  it('calcula cuota, número de cuota, saldo pendiente y lo que se pactó', () => {
    const [deuda] = deudasDe([obligacion()], '2026-10-28');

    expect(deuda).toMatchObject({
      persona: 'Andrés',
      descripcion: 'Zapatos',
      direccion: 'owing',
      moneda: 'COP',
      valor: 300000,
      cuota: 50000,
      cuotaActual: 3,
      totalCuotas: 6,
      pendiente: 200000,
      tarjeta: 'Visa',
    });
  });

  it('con tasa mensual la cuota es la fija del sistema francés', () => {
    const [deuda] = deudasDe([obligacion({ terms: { ...obligacion().terms!, monthlyRate: 0.02 } })], '2026-10-28');
    expect(deuda.cuota).toBeCloseTo(53558, 0);
  });

  it('sin plazo pactado no inventa cuotas', () => {
    const [deuda] = deudasDe([obligacion({ terms: null })], '2026-10-28');
    expect(deuda.cuota).toBeNull();
    expect(deuda.totalCuotas).toBeNull();
  });
});

describe('comportamientoDePago', () => {
  it('está al día si los pagos cubren las cuotas ya vencidas', () => {
    const [deuda] = deudasDe([obligacion({ openedOn: '2026-09-15' })], '2026-10-28');
    expect(comportamientoDePago([deuda])).toEqual({ estado: 'alDia', atrasadas: 0 });
  });

  it('marca atraso con cuántas cuotas faltan por pagar', () => {
    const [deuda] = deudasDe([obligacion({ openedOn: '2026-06-15' })], '2026-10-28');
    expect(comportamientoDePago([deuda])).toEqual({ estado: 'atrasado', atrasadas: 3 });
  });

  it('sin cuotas pactadas lo dice en vez de suponer', () => {
    const [deuda] = deudasDe([obligacion({ terms: null })], '2026-10-28');
    expect(comportamientoDePago([deuda])).toEqual({ estado: 'sinPlazo', atrasadas: 0 });
    expect(comportamientoDePago([])).toEqual({ estado: 'sinDeudas', atrasadas: 0 });
  });
});

describe('masAtrasado', () => {
  it('elige a la persona con más cuotas vencidas sin pagar', () => {
    const deudas = deudasDe(
      [
        obligacion({ id: 'a', openedOn: '2026-06-15' }),
        obligacion({ id: 'b', openedOn: '2026-09-15', counterparty: { id: 'p2', name: 'Laura' } }),
      ],
      '2026-10-28',
    );
    expect(masAtrasado(deudas)).toEqual({ persona: 'Andrés', atrasadas: 3 });
  });

  it('sin atrasos no señala a nadie', () => {
    expect(masAtrasado(deudasDe([obligacion({ openedOn: '2026-09-15' })], '2026-10-28'))).toBeNull();
  });
});
