export function fechaDeHoy(isoHoy: string): { anio: number; mes: number; iso: string } {
  const [anio, mes] = isoHoy.split('-').map(Number);
  return { anio, mes: mes - 1, iso: isoHoy };
}
