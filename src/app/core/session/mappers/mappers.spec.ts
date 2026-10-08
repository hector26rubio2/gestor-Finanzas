import { ApiNotification } from '@core/api/api-client';
import { tasaAnual } from './accounts.mapper';
import { notificationDetail } from './notifications.mapper';
import { cuotaEnCurso, toMovement } from './movements.mapper';
import type { ApiMovement } from '@core/api/ledger.api';
import { CARD_BUCKET } from '@core/api/card-buckets';
import { I18nService } from '@core/i18n';
import { EMPTY_KIND_CATALOG, MovementKind } from '@core/utils/movement-kinds';
import { totalDeGastos, totalDeIngresos } from '@core/state/economia';

function notificacion(payloadJson: string): ApiNotification {
  return { id: 'n1', kind: 'aviso', title: 'Aviso', payloadJson, readAt: null, createdAt: '2026-01-01' };
}

describe('mappers por dominio', () => {
  it('tasaAnual distingue tasa ausente de tasa cero', () => {
    expect(tasaAnual(null)).toBeUndefined();
    expect(tasaAnual('0')).toBe(0);
    expect(tasaAnual('0.285')).toBe(28.5);
    expect(tasaAnual('no-numero')).toBeUndefined();
  });

  it('notificationDetail usa detail, luego description y cae al tipo', () => {
    expect(notificationDetail(notificacion('{"detail":"Pago recibido"}'))).toBe('Pago recibido');
    expect(notificationDetail(notificacion('{"description":"Corte"}'))).toBe('Corte');
    expect(notificationDetail(notificacion('no es json'))).toBe('aviso');
  });

  it('cuotaEnCurso avanza por mes y no pasa del total', () => {
    expect(cuotaEnCurso('2026-01-15', 6, '2026-01-20')).toBe(1);
    expect(cuotaEnCurso('2026-01-15', 6, '2026-03-01')).toBe(3);
    expect(cuotaEnCurso('2025-01-15', 6, '2026-03-01')).toBe(6);
  });
});

describe('concepto de los cargos de tarjeta', () => {
  const cargo = (kind: number, cardBucket?: number): ApiMovement => ({
    id: 'c1',
    date: '2026-09-25',
    kind,
    effect: 2,
    flow: 2,
    amount: {
      original: { amount: '25000', currency: 'COP' },
      base: { amount: '25000', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-09-25',
    },
    links: { card: 'tarjeta-1' },
    linkNames: {},
    origin: 0,
    description: 'Cargo',
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...(cardBucket ? { cardBucket } : {}),
  });
  const i18n = { t: (clave: string) => clave } as unknown as I18nService;

  it('la cuota de manejo y los intereses van a comisiones', () => {
    expect(toMovement(i18n, EMPTY_KIND_CATALOG, cargo(MovementKind.cardFee)).cardBucket).toBe(CARD_BUCKET.fees);
    expect(toMovement(i18n, EMPTY_KIND_CATALOG, cargo(MovementKind.cardInterest)).cardBucket).toBe(CARD_BUCKET.fees);
  });

  it('una compra conserva el tipo que eligió la persona', () => {
    const compra = toMovement(
      i18n,
      EMPTY_KIND_CATALOG,
      cargo(MovementKind.cardPurchase, CARD_BUCKET.zeroRatePurchases),
    );
    expect(compra.cardBucket).toBe(CARD_BUCKET.zeroRatePurchases);
  });
});

describe('reversos y efecto económico', () => {
  const gasto = (cambios: Partial<ApiMovement> = {}): ApiMovement => ({
    id: 'g1',
    date: '2026-09-25',
    kind: MovementKind.expense,
    effect: 2,
    flow: 2,
    amount: {
      original: { amount: '100000', currency: 'COP' },
      base: { amount: '100000', currency: 'COP' },
      rate: '1',
      rateAsOf: '2026-09-25',
    },
    links: { account: 'cuenta-1' },
    linkNames: {},
    origin: 0,
    description: 'Mercado',
    createdAt: '2026-09-25T12:00:00Z',
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
    ...cambios,
  });
  const i18n = { t: (clave: string) => clave } as unknown as I18nService;

  it('el reverso invierte el signo para que el gasto y su reverso sumen cero', () => {
    const original = toMovement(i18n, EMPTY_KIND_CATALOG, gasto({ reversedBy: 'g2' }));
    const reverso = toMovement(i18n, EMPTY_KIND_CATALOG, gasto({ id: 'g2', reversalOf: 'g1' }));
    expect(original.amount).toBe(-100000);
    expect(reverso.amount).toBe(100000);
    expect(totalDeGastos([original, reverso])).toBe(0);
  });

  it('el efecto viene del API y define gasto e ingreso', () => {
    const transferencia = toMovement(i18n, EMPTY_KIND_CATALOG, gasto({ effect: 0, kind: MovementKind.transferOut }));
    const ingreso = toMovement(i18n, EMPTY_KIND_CATALOG, gasto({ effect: 1, flow: 1, kind: MovementKind.income }));
    expect(transferencia.effect).toBe('neutral');
    expect(totalDeGastos([transferencia])).toBe(0);
    expect(totalDeIngresos([ingreso])).toBe(100000);
  });
});
