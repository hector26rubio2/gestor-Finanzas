import { signal } from '@angular/core';

export const BASE_CURRENCY = 'COP';

export const baseCurrency = signal(BASE_CURRENCY);

export interface CurrencyOption {
  readonly code: string;
  readonly minorUnits: number;
}

export const LOCAL_CURRENCIES: readonly CurrencyOption[] = [
  { code: 'COP', minorUnits: 0 },
  { code: 'USD', minorUnits: 2 },
  { code: 'EUR', minorUnits: 2 },
];

const DECIMALS_BY_CURRENCY: Readonly<Record<string, number>> = { COP: 0, USD: 2, EUR: 2 };

export const currencyCatalog = signal<readonly CurrencyOption[]>(LOCAL_CURRENCIES);

export function setCurrencyCatalog(currencies: readonly CurrencyOption[]): void {
  const validas = currencies
    .map((currency) => ({ code: currency.code.trim().toUpperCase(), minorUnits: currency.minorUnits }))
    .filter(
      (currency) => currency.code.length === 3 && Number.isInteger(currency.minorUnits) && currency.minorUnits >= 0,
    );
  if (validas.length === 0) return;
  currencyCatalog.set(validas);
}

const DECIMAL_PATTERN = /^[+-]?\d+(?:\.\d+)?$/;

export interface MoneyLike {
  readonly amount: string;
  readonly currency: string;
}

export function decimalsFor(currency: string | null | undefined): number {
  const codigo = (currency ?? '').trim().toUpperCase() || baseCurrency().trim().toUpperCase();
  const publicada = currencyCatalog().find((option) => option.code === codigo);
  if (publicada) return publicada.minorUnits;
  if (DECIMALS_BY_CURRENCY[codigo] !== undefined) return DECIMALS_BY_CURRENCY[codigo];
  return 2;
}

export function toMinor(amount: string | null | undefined, currency: string = baseCurrency()): number {
  if (amount === null || amount === undefined) return 0;
  const text = amount.trim();
  if (text.length === 0) return 0;
  if (!DECIMAL_PATTERN.test(text)) {
    throw new TypeError(`Importe no decimal recibido de la API: ${JSON.stringify(amount)}`);
  }

  const negative = text.startsWith('-');
  const unsigned = text.replace(/^[+-]/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  const decimals = decimalsFor(currency);

  const kept = fraction.slice(0, decimals).padEnd(decimals, '0');
  const nextDigit = fraction.charCodeAt(decimals) - 48;
  const base = Number(whole) * 10 ** decimals + Number(kept || '0');
  const rounded = nextDigit >= 5 ? base + 1 : base;
  return negative ? -rounded : rounded;
}

export function fromMinor(minor: number, currency: string = baseCurrency()): number {
  const decimals = decimalsFor(currency);
  return decimals === 0 ? minor : minor / 10 ** decimals;
}

export function minorOf(value: number, currency: string = baseCurrency()): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10 ** decimalsFor(currency));
}

export function parseAmount(amount: string | null | undefined, currency: string = baseCurrency()): number {
  return fromMinor(toMinor(amount, currency), currency);
}

export function parseMoney(money: MoneyLike | null | undefined): number {
  if (!money) return 0;
  return parseAmount(money.amount, money.currency);
}

export function parseRate(rate: string | null | undefined): number {
  if (rate === null || rate === undefined || rate.trim().length === 0) return 0;
  const text = rate.trim();
  if (!DECIMAL_PATTERN.test(text)) {
    throw new TypeError(`Tasa no decimal recibida de la API: ${JSON.stringify(rate)}`);
  }
  return Number(text);
}

export function sumAmounts(values: Iterable<number>, currency: string = baseCurrency()): number {
  let total = 0;
  for (const value of values) total += minorOf(value, currency);
  return fromMinor(total, currency);
}

export function sumBy<T>(items: Iterable<T>, selector: (item: T) => number, currency: string = baseCurrency()): number {
  let total = 0;
  for (const item of items) total += minorOf(selector(item), currency);
  return fromMinor(total, currency);
}

export function returnRate(value: number, cost: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(cost) || cost === 0) return null;
  return (value / cost - 1) * 100;
}

export function formatReturnRate(value: number, cost: number): string {
  const tasa = returnRate(value, cost);
  return tasa === null ? '—' : `${tasa.toFixed(1)} %`;
}

export function formatAmount(value: number, currency: string, locale: string): string {
  const decimals = decimalsFor(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}
