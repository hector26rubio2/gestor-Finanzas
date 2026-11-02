const redondear = (valor: number, decimales: number) => Math.round(valor * 10 ** decimales) / 10 ** decimales;

export function mensualDesdeAnual(anualPorcentaje: number): number {
  return redondear(((1 + anualPorcentaje / 100) ** (1 / 12) - 1) * 100, 4);
}

export function anualDesdeMensual(mensualPorcentaje: number): number {
  return redondear(((1 + mensualPorcentaje / 100) ** 12 - 1) * 100, 3);
}

export type Tasa = { readonly porcentaje: number } | { readonly fraccion: number };

export const enPorcentaje = (porcentaje: number): Tasa => ({ porcentaje });

export const enFraccion = (fraccion: number): Tasa => ({ fraccion });

const comoFraccion = (tasa: Tasa): number => Math.max(0, 'porcentaje' in tasa ? tasa.porcentaje / 100 : tasa.fraccion);

export function cuotaFija(capital: number, tasa: Tasa, meses: number): number {
  if (capital <= 0 || meses <= 0) return 0;
  const i = comoFraccion(tasa);
  if (i === 0) return capital / meses;
  return (capital * i) / (1 - (1 + i) ** -meses);
}
