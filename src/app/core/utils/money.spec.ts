import { afterEach, describe, expect, it } from 'vitest';
import {
  BASE_CURRENCY,
  baseCurrency,
  currencyCatalog,
  decimalsFor,
  formatAmount,
  fromMinor,
  LOCAL_CURRENCIES,
  parseAmount,
  parseMoney,
  parseRate,
  setCurrencyCatalog,
  sumAmounts,
  sumBy,
  toMinor,
} from './money';

describe('money', () => {
  it('lee COP sin decimales y conserva magnitudes grandes', () => {
    expect(toMinor('15000000', 'COP')).toBe(15000000);
    expect(parseAmount('15000000', 'COP')).toBe(15000000);
    expect(parseAmount('9007199254740', 'COP')).toBe(9007199254740);
  });

  it('lee USD en centavos enteros', () => {
    expect(toMinor('1234.56', 'USD')).toBe(123456);
    expect(parseAmount('1234.56', 'USD')).toBe(1234.56);
  });

  it('redondea media unidad hacia arriba en valor absoluto', () => {
    expect(toMinor('0.005', 'USD')).toBe(1);
    expect(toMinor('-0.005', 'USD')).toBe(-1);
    expect(toMinor('0.004', 'USD')).toBe(0);
    expect(toMinor('1234.5', 'COP')).toBe(1235);
  });

  it('suma sin arrastrar el error del punto flotante', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumAmounts([0.1, 0.2], 'USD')).toBe(0.3);
    expect(sumAmounts([parseAmount('0.10', 'USD'), parseAmount('0.20', 'USD')], 'USD')).toBe(0.3);
  });

  it('mantiene la exactitud al sumar cien centavos', () => {
    const centavos = Array.from({ length: 100 }, () => 0.01);
    expect(centavos.reduce((total, value) => total + value, 0)).not.toBe(1);
    expect(sumAmounts(centavos, 'USD')).toBe(1);
  });

  it('suma con selector sobre una colección', () => {
    const movimientos = [{ importe: 19.99 }, { importe: 0.01 }, { importe: -5.5 }];
    expect(sumBy(movimientos, (m) => m.importe, 'USD')).toBe(14.5);
  });

  it('rechaza lo que no es un decimal invariante en vez de producir NaN', () => {
    expect(() => toMinor('1,234.56', 'USD')).toThrow(TypeError);
    expect(() => toMinor('abc', 'COP')).toThrow(TypeError);
    expect(() => parseRate('1.2.3')).toThrow(TypeError);
  });

  it('trata la ausencia de importe como cero, no como NaN', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseMoney(null)).toBe(0);
  });

  it('usa la moneda del par cuando viene del contrato', () => {
    expect(parseMoney({ amount: '10.55', currency: 'USD' })).toBe(10.55);
    expect(parseMoney({ amount: '10', currency: 'COP' })).toBe(10);
  });

  it('conoce los decimales de cada moneda del contrato', () => {
    expect(decimalsFor('COP')).toBe(0);
    expect(decimalsFor('usd')).toBe(2);
    expect(decimalsFor('EUR')).toBe(2);
    expect(decimalsFor(null)).toBe(0);
    expect(fromMinor(123456, 'USD')).toBe(1234.56);
  });

  it('formatea con el código de moneda para que no haya un peso ambiguo', () => {
    const cop = formatAmount(3174700, 'COP', 'es-CO');
    expect(cop).toContain('COP');
    expect(cop).not.toMatch(/^\$/);
    expect(formatAmount(1234.5, 'USD', 'es-CO')).toContain('USD');
    expect(formatAmount(1234.5, 'USD', 'es-CO')).toContain('1.234,50');
  });

  it('no rompe el formato ante un valor no finito', () => {
    expect(formatAmount(Number.NaN, 'COP', 'es-CO')).toContain('0');
  });

  afterEach(() => {
    baseCurrency.set(BASE_CURRENCY);
    currencyCatalog.set(LOCAL_CURRENCIES);
  });

  it('la moneda base que trae el servidor gobierna decimales y sumas por defecto', () => {
    setCurrencyCatalog([
      { code: 'cop', minorUnits: 0 },
      { code: 'USD', minorUnits: 2 },
    ]);
    baseCurrency.set('USD');
    expect(decimalsFor(null)).toBe(2);
    expect(toMinor('1234.5')).toBe(123450);
    expect(sumBy([{ importe: 19.99 }], (m) => m.importe)).toBe(19.99);
    expect(formatAmount(1234.5, 'USD', 'es-CO')).toContain('1.234,50');

    baseCurrency.set('COP');
    expect(decimalsFor(null)).toBe(0);
    expect(toMinor('1234.5')).toBe(1235);
  });

  it('lee los decimales del catálogo del servidor y no se deja vaciar', () => {
    expect(decimalsFor('JPY')).toBe(2);
    setCurrencyCatalog([{ code: 'JPY', minorUnits: 0 }, ...LOCAL_CURRENCIES]);
    expect(decimalsFor('jpy')).toBe(0);
    expect(toMinor('1000.4', 'JPY')).toBe(1000);
    setCurrencyCatalog([]);
    expect(decimalsFor('JPY')).toBe(0);
    expect(currencyCatalog().some((option) => option.code === 'COP')).toBe(true);
  });
});
