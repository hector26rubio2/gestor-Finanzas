import type { DeudaEnOtraMoneda, Person } from '@core/state';

export function totalesEnOtrasMonedas(personas: readonly Person[]): DeudaEnOtraMoneda[] {
  const totales = new Map<string, DeudaEnOtraMoneda>();
  for (const persona of personas) {
    for (const saldo of persona.otherCurrencies ?? []) {
      const actual = totales.get(saldo.currency) ?? { currency: saldo.currency, owed: 0, owing: 0 };
      totales.set(saldo.currency, {
        currency: saldo.currency,
        owed: actual.owed + saldo.owed,
        owing: actual.owing + saldo.owing,
      });
    }
  }
  return [...totales.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function monedasDe(persona: Person, monedaBase: string): string {
  const otras = (persona.otherCurrencies ?? []).map((saldo) => saldo.currency).sort();
  return otras.length ? `${monedaBase} + ${otras.join(', ')}` : monedaBase;
}
