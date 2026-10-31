export interface GastoDeCategoria {
  readonly date: string;
  readonly category: string;
  readonly monto: number;
}

export interface GastoDeFecha {
  readonly date: string;
  readonly monto: number;
}

export function mesesCerrados(periodos: readonly string[], hoy: string): string[] {
  const actual = hoy.slice(0, 7);
  return periodos.filter((mes) => mes < actual);
}

export function gastoPromedioMensual(gastos: readonly GastoDeFecha[], cerrados: readonly string[]): number {
  if (!cerrados.length) return 0;
  const incluidos = new Set(cerrados);
  const total = gastos.filter((g) => incluidos.has(g.date.slice(0, 7))).reduce((suma, g) => suma + g.monto, 0);
  return total / cerrados.length;
}

export function mayorSubida(
  gastos: readonly GastoDeCategoria[],
  cerrados: readonly string[],
): { nombre: string; porcentaje: number } | null {
  if (cerrados.length < 2) return null;
  const [anterior, actual] = cerrados.slice(-2);
  const porMes = (mes: string) => {
    const totales = new Map<string, number>();
    for (const g of gastos.filter((m) => m.date.startsWith(mes)))
      totales.set(g.category, (totales.get(g.category) ?? 0) + g.monto);
    return totales;
  };
  const antes = porMes(anterior);
  let mejor: { nombre: string; porcentaje: number } | null = null;
  for (const [nombre, valor] of porMes(actual)) {
    const previo = antes.get(nombre) ?? 0;
    if (previo <= 0 || valor <= previo) continue;
    const porcentaje = Math.round(((valor - previo) / previo) * 100);
    if (!mejor || porcentaje > mejor.porcentaje) mejor = { nombre, porcentaje };
  }
  return mejor;
}
