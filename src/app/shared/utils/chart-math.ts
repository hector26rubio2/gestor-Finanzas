export function compactMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function acumulada(serie: readonly number[]): number[] {
  let suma = 0;
  return serie.map((valor) => (suma += valor));
}
