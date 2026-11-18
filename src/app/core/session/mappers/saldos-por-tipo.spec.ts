import { describe, expect, it } from 'vitest';
import type { ApiMovement } from '@core/api/api-client';
import type { I18nService } from '@core/i18n';
import { Account, accountBalance } from '@core/state/view-model';
import { CashFlow, EconomicEffect, EMPTY_KIND_CATALOG, MovementKind } from '@core/utils/movement-kinds';
import { toMovement } from './movements.mapper';

const i18n = { t: (clave: string) => clave } as unknown as I18nService;

function api(
  id: string,
  kind: number,
  efecto: number,
  flujo: number,
  monto: number,
  vinculo: Record<string, string>,
  extra: Partial<ApiMovement> = {},
): ApiMovement {
  const importe = { amount: String(monto), currency: 'COP' };
  return {
    id,
    date: '2026-09-25',
    kind,
    effect: efecto,
    flow: flujo,
    amount: { original: importe, base: importe, rate: '1', rateAsOf: '2026-09-25' },
    links: vinculo,
    linkNames: {},
    origin: 0,
    description: id,
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...extra,
  };
}

const cuentas: Account[] = [
  { id: 'cuenta', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 1_000_000 },
  { id: 'otra', name: 'Efectivo', type: 'cash', currency: 'COP', openingBalance: 0 },
  { id: 'tarjeta', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 },
];

const { expense, income, transferOut, transferIn, cardPurchase, cardPayment, cardCashAdvance } = MovementKind;
const { loanDisbursement, loanRepayment } = MovementKind;
const { neutral } = EconomicEffect;
const { inflow, outflow } = CashFlow;

const pasos: { tipo: string; movimientos: ApiMovement[]; cuenta: number; otra: number; tarjeta: number }[] = [
  {
    tipo: 'gasto',
    movimientos: [api('gasto', expense, EconomicEffect.expense, outflow, 100_000, { account: 'cuenta' })],
    cuenta: 900_000,
    otra: 0,
    tarjeta: 0,
  },
  {
    tipo: 'ingreso',
    movimientos: [api('ingreso', income, EconomicEffect.income, inflow, 50_000, { account: 'cuenta' })],
    cuenta: 950_000,
    otra: 0,
    tarjeta: 0,
  },
  {
    tipo: 'transferencia',
    movimientos: [
      api('sale', transferOut, neutral, outflow, 200_000, { account: 'cuenta' }),
      api('entra', transferIn, neutral, inflow, 200_000, { account: 'otra' }),
    ],
    cuenta: 750_000,
    otra: 200_000,
    tarjeta: 0,
  },
  {
    tipo: 'compra con tarjeta',
    movimientos: [api('compra', cardPurchase, EconomicEffect.expense, outflow, 300_000, { card: 'tarjeta' })],
    cuenta: 750_000,
    otra: 200_000,
    tarjeta: -300_000,
  },
  {
    tipo: 'pago de tarjeta',
    movimientos: [
      api('pago-cuenta', cardPayment, neutral, outflow, 120_000, { account: 'cuenta' }),
      api('pago-tarjeta', cardPayment, neutral, inflow, 120_000, { card: 'tarjeta' }),
    ],
    cuenta: 630_000,
    otra: 200_000,
    tarjeta: -180_000,
  },
  {
    tipo: 'avance de tarjeta',
    movimientos: [
      api('avance-tarjeta', cardCashAdvance, neutral, outflow, 80_000, { card: 'tarjeta' }),
      api('avance-cuenta', cardCashAdvance, neutral, inflow, 80_000, { account: 'cuenta' }),
    ],
    cuenta: 710_000,
    otra: 200_000,
    tarjeta: -260_000,
  },
  {
    tipo: 'préstamo otorgado',
    movimientos: [api('prestamo', loanDisbursement, neutral, outflow, 150_000, { account: 'cuenta' })],
    cuenta: 560_000,
    otra: 200_000,
    tarjeta: -260_000,
  },
  {
    tipo: 'cobro de una cuota del préstamo',
    movimientos: [api('cuota', loanRepayment, neutral, inflow, 40_000, { account: 'cuenta' })],
    cuenta: 600_000,
    otra: 200_000,
    tarjeta: -260_000,
  },
  {
    tipo: 'reverso del gasto',
    movimientos: [
      api('reverso', expense, EconomicEffect.expense, outflow, 100_000, { account: 'cuenta' }, { reversalOf: 'gasto' }),
    ],
    cuenta: 700_000,
    otra: 200_000,
    tarjeta: -260_000,
  },
];

describe('saldo de cuentas y tarjetas tras cada tipo de movimiento', () => {
  const acumulados = pasos.map((_, indice) =>
    pasos
      .slice(0, indice + 1)
      .flatMap((paso) => paso.movimientos)
      .map((movimiento) => {
        const mapeado = toMovement(i18n, EMPTY_KIND_CATALOG, movimiento);
        return { ...mapeado, accountId: movimiento.links['account'] ?? movimiento.links['card'] ?? '' };
      }),
  );

  it.each(pasos.map((paso, indice) => ({ ...paso, indice })))(
    'después de $tipo los saldos son los esperados',
    ({ indice, cuenta, otra, tarjeta }) => {
      const movimientos = acumulados[indice];
      const saldo = (id: string) =>
        accountBalance(
          cuentas.find((c) => c.id === id)!,
          movimientos,
        );

      expect(saldo('cuenta')).toBe(cuenta);
      expect(saldo('otra')).toBe(otra);
      expect(saldo('tarjeta')).toBe(tarjeta);
    },
  );
});
