/**
 * Aritmética de dinero exacta para el cliente.
 *
 * El contrato entrega los importes como cadena decimal en cultura invariante y
 * prohíbe `number` justamente porque IEEE-754 no representa 0,1 ni 0,2. Aquí se
 * respeta esa decisión donde importa: el parseo pasa por enteros de unidad menor
 * y las sumas se acumulan en esa misma escala, así que ningún total arrastra
 * polvo binario. La conversión a `number` ocurre una sola vez, al final, y ya
 * redondeada a la precisión de la moneda.
 */

import { signal } from '@angular/core';

/** Moneda base del espacio de trabajo mientras no hay sesión. El backend publica COP con cero decimales. */
export const BASE_CURRENCY = 'COP';

/**
 * Moneda base vigente, la que el backend usa para calcular los importes de la organización.
 *
 * Arranca en el valor de compilación y la escribe la sesión con
 * `session.organization.baseCurrency` (ver `remote-bootstrap.aplicarSesion`). Es la única
 * fuente: `money()`, `sumBy()` y `decimalsFor()` leen de aquí, así que cambiar de
 * organización no deja etiquetas ni sumas viejas a mitad de pantalla.
 */
export const baseCurrency = signal(BASE_CURRENCY);

/** Una moneda del catálogo: código ISO 4217 y decimales que publica el servidor. */
export interface CurrencyOption {
  readonly code: string;
  readonly minorUnits: number;
}

/**
 * Catálogo de referencia, igual al que devuelve `GET /api/v1/currencies`. Existe para que
 * el modo demo y la pantalla de organización tengan monedas que ofrecer antes de que
 * nadie haya entrado en la API.
 */
export const LOCAL_CURRENCIES: readonly CurrencyOption[] = [
  { code: 'COP', minorUnits: 0 },
  { code: 'USD', minorUnits: 2 },
  { code: 'EUR', minorUnits: 2 },
];

/** Espejo de `GET /api/v1/currencies`. COP usa 0 decimales por uso cotidiano, no los 2 de ISO 4217. */
const DECIMALS_BY_CURRENCY: Readonly<Record<string, number>> = { COP: 0, USD: 2, EUR: 2 };

/** Catálogo vigente. Lo sustituye el servidor al arrancar la sesión. */
export const currencyCatalog = signal<readonly CurrencyOption[]>(LOCAL_CURRENCIES);

/**
 * Publica el catálogo que trae el servidor.
 *
 * Un catálogo vacío o mal formado no borra lo que ya se sabía: sin monedas conocidas
 * habría que adivinar los decimales de COP y las sumas volverían a redondear centavos
 * en silencio. Prefiero conservar el anterior antes que quedar sin ninguno.
 */
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
  // Sin moneda explícita se usa la base del espacio de trabajo: es la moneda en la que
  // viven los importes que no traen la suya propia.
  const codigo = (currency ?? '').trim().toUpperCase() || baseCurrency().trim().toUpperCase();
  const publicada = currencyCatalog().find((option) => option.code === codigo);
  if (publicada) return publicada.minorUnits;
  if (DECIMALS_BY_CURRENCY[codigo] !== undefined) return DECIMALS_BY_CURRENCY[codigo];
  // ISO 4217: la norma deja dos decimales a casi todo el mundo —JPY, KRW y CLP son la
  // excepción—, así que sin dato del servidor se pinta con dos y no se inventa cero. El
  // catálogo público es quien corrige la excepción en cuanto llega.
  return 2;
}

/**
 * Convierte una cadena decimal invariante en unidades menores enteras.
 * Redondea media unidad hacia arriba en valor absoluto, como el backend.
 */
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

/** Devuelve unidades mayores desde unidades menores. Es la única división del módulo. */
export function fromMinor(minor: number, currency: string = baseCurrency()): number {
  const decimals = decimalsFor(currency);
  return decimals === 0 ? minor : minor / 10 ** decimals;
}

/** Lleva unidades mayores a menores sin arrastrar el error del literal flotante. */
export function minorOf(value: number, currency: string = baseCurrency()): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10 ** decimalsFor(currency));
}

/**
 * Parseo del contrato a unidades mayores, ya redondeado a la precisión de la
 * moneda. Es el único punto por el que un importe de la API entra a la vista.
 */
export function parseAmount(amount: string | null | undefined, currency: string = baseCurrency()): number {
  return fromMinor(toMinor(amount, currency), currency);
}

/** Igual que `parseAmount`, pero tomando el par importe/moneda del contrato. */
export function parseMoney(money: MoneyLike | null | undefined): number {
  if (!money) return 0;
  return parseAmount(money.amount, money.currency);
}

/** Tasa de cambio: no es dinero, así que conserva sus decimales, pero valida igual. */
export function parseRate(rate: string | null | undefined): number {
  if (rate === null || rate === undefined || rate.trim().length === 0) return 0;
  const text = rate.trim();
  if (!DECIMAL_PATTERN.test(text)) {
    throw new TypeError(`Tasa no decimal recibida de la API: ${JSON.stringify(rate)}`);
  }
  return Number(text);
}

/** Suma exacta: acumula en unidades menores y divide una sola vez. */
export function sumAmounts(values: Iterable<number>, currency: string = baseCurrency()): number {
  let total = 0;
  for (const value of values) total += minorOf(value, currency);
  return fromMinor(total, currency);
}

/** Suma exacta sobre una colección, con selector. Reemplaza a `reduce` sobre importes. */
export function sumBy<T>(items: Iterable<T>, selector: (item: T) => number, currency: string = baseCurrency()): number {
  let total = 0;
  for (const item of items) total += minorOf(selector(item), currency);
  return fromMinor(total, currency);
}

/**
 * Rendimiento porcentual de una inversión, o `null` si no se puede calcular.
 *
 * Dividir por el coste sin mirarlo daba dos cifras que se enseñaban tal cual: con la
 * cartera vacía la pantalla ponía «NaN %», y con una inversión de coste cero —una
 * herencia, una acción entregada— «Infinity %». Un porcentaje que no existe no se
 * inventa: quien lea la pantalla no tiene forma de saber que ese número no significa
 * nada.
 */
export function returnRate(value: number, cost: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(cost) || cost === 0) return null;
  return (value / cost - 1) * 100;
}

/** El mismo rendimiento, ya escrito para la pantalla. */
export function formatReturnRate(value: number, cost: number): string {
  const tasa = returnRate(value, cost);
  return tasa === null ? '—' : `${tasa.toFixed(1)} %`;
}

/**
 * Formato con código de moneda explícito: en Colombia `$` a secas es ambiguo, y
 * esta aplicación maneja COP, USD y EUR en la misma pantalla.
 */
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
