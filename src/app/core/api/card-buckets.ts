export const CARD_BUCKET = {
  pastDue: 1,
  fees: 2,
  creditBalance: 3,
  deferredFees: 4,
  singleInstallmentPurchases: 5,
  singleInstallmentAdjustments: 6,
  secondPurchasePlan: 7,
  deferredInstallmentPurchases: 8,
  taxes: 9,
  preferentialRateOffer: 10,
  officeTax: 11,
  internationalPurchases: 12,
  cashAdvances: 13,
  internationalCashAdvances: 14,
  balanceTransfer: 15,
  secondaryOffers: 16,
  zeroRatePurchases: 17,
  termExtension: 18,
  cashRetail: 19,
} as const;

export type CardBucketKey = keyof typeof CARD_BUCKET;
export type CardBucket = (typeof CARD_BUCKET)[CardBucketKey];

const CLAVE_DE_CONCEPTO = new Map<number, CardBucketKey>(
  (Object.entries(CARD_BUCKET) as [CardBucketKey, CardBucket][]).map(([clave, valor]) => [valor, clave]),
);

export function claveDeConcepto(valor: number): CardBucketKey | undefined {
  return CLAVE_DE_CONCEPTO.get(valor);
}

export const PRIORIDAD_EN_PESOS: readonly CardBucket[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
];
export const PRIORIDAD_EN_DOLARES: readonly CardBucket[] = [1, 2, 3, 4, 8, 6, 13, 17, 18, 19];

export const TIPOS_DE_COMPRA: readonly CardBucket[] = [
  CARD_BUCKET.deferredInstallmentPurchases,
  CARD_BUCKET.singleInstallmentPurchases,
  CARD_BUCKET.zeroRatePurchases,
  CARD_BUCKET.preferentialRateOffer,
  CARD_BUCKET.internationalPurchases,
  CARD_BUCKET.balanceTransfer,
  CARD_BUCKET.secondPurchasePlan,
  CARD_BUCKET.termExtension,
  CARD_BUCKET.cashRetail,
];

export function completarPrioridad(
  prioridad: readonly number[] | null | undefined,
  porDefecto: readonly CardBucket[],
): CardBucket[] {
  const conocidos = (prioridad ?? []).filter((valor): valor is CardBucket => CLAVE_DE_CONCEPTO.has(valor));
  const unicos = [...new Set(conocidos)];
  return [...unicos, ...porDefecto.filter((valor) => !unicos.includes(valor))];
}

export function conceptoDeCompra(opciones: {
  kind: 'income' | 'expense' | 'payment';
  cardBucket?: number;
  installmentTotal?: number;
  originalCurrency?: string;
  movementSubtype?: string;
  category?: string;
}): CardBucket | null {
  if (opciones.kind !== 'expense') return null;
  if (opciones.cardBucket && CLAVE_DE_CONCEPTO.has(opciones.cardBucket)) return opciones.cardBucket as CardBucket;
  const extranjera = !!opciones.originalCurrency && opciones.originalCurrency !== 'COP';
  if (opciones.movementSubtype === 'advance')
    return extranjera ? CARD_BUCKET.internationalCashAdvances : CARD_BUCKET.cashAdvances;
  if (extranjera) return CARD_BUCKET.internationalPurchases;
  return (opciones.installmentTotal ?? 1) > 1
    ? CARD_BUCKET.deferredInstallmentPurchases
    : CARD_BUCKET.singleInstallmentPurchases;
}
