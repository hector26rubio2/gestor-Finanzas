export type TipoDeEntradaDeAgenda = 'recurrente' | 'vencimiento' | 'movimiento';

const PESO_DEL_TIPO: Readonly<Record<TipoDeEntradaDeAgenda, number>> = { recurrente: 0, vencimiento: 1, movimiento: 2 };

export function ordenarAgenda<E extends { tipo: TipoDeEntradaDeAgenda; fecha: string }>(entradas: readonly E[]): E[] {
  return [...entradas].sort((a, b) => a.fecha.localeCompare(b.fecha) || PESO_DEL_TIPO[a.tipo] - PESO_DEL_TIPO[b.tipo]);
}
