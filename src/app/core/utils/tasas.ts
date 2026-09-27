const redondear = (valor: number, decimales: number) => Math.round(valor * 10 ** decimales) / 10 ** decimales;

export function mensualDesdeAnual(anualPorcentaje: number): number {
  return redondear(((1 + anualPorcentaje / 100) ** (1 / 12) - 1) * 100, 4);
}

export function anualDesdeMensual(mensualPorcentaje: number): number {
  return redondear(((1 + mensualPorcentaje / 100) ** 12 - 1) * 100, 3);
}

export function cuotaFija(capital: number, mensualPorcentaje: number, meses: number): number {
  if (meses <= 0) return 0;
  const tasa = mensualPorcentaje / 100;
  if (tasa === 0) return capital / meses;
  return (capital * tasa) / (1 - (1 + tasa) ** -meses);
}
