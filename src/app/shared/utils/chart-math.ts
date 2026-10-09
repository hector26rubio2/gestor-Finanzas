import { baseCurrency } from '@core/utils/money';

export function compactMoney(value: number, locale: string, currency: string = baseCurrency()): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
