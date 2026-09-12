/** Convierte una serie en puntos de un `<polyline>`, usados por Planificación y Reportes. */
export function chartPoints(values: readonly number[], maximum: number, width: number, height: number): string {
  const safeMaximum = Math.max(1, maximum);
  const drawableHeight = height - 20;
  return values
    .map((value, index) => {
      const x = values.length < 2 ? width / 2 : (index / (values.length - 1)) * width;
      const y = 10 + drawableHeight - (Math.max(0, value) / safeMaximum) * drawableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Cifra compacta ($1,2 M) en la moneda y el idioma de las preferencias del usuario. */
export function compactMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
