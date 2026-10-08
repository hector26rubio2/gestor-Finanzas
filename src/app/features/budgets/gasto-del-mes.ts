import { Signal, computed } from '@angular/core';
import { esGasto, montoDeGasto } from '@core/state/economia';
import { crearMovimientosDelPeriodo, type Rango } from '@shared/historia';

export function crearGastoPorCategoria(mes: Signal<Rango | null>) {
  const delMes = crearMovimientosDelPeriodo(mes);
  const gastoPorCategoria = computed(() => {
    const totales = new Map<string, number>();
    for (const movimiento of delMes.movimientos())
      if (esGasto(movimiento) && !movimiento.anulado)
        totales.set(movimiento.category, (totales.get(movimiento.category) ?? 0) + montoDeGasto(movimiento));
    return totales as ReadonlyMap<string, number>;
  });
  return { gastoPorCategoria, cargando: delMes.cargando };
}

export function rangoDelMes(referencia: string): Rango {
  const [anio, mes] = referencia.split('-').map(Number);
  const ultimo = new Date(anio, mes, 0).getDate();
  const pad = (valor: number) => String(valor).padStart(2, '0');
  return { start: `${anio}-${pad(mes)}-01`, end: `${anio}-${pad(mes)}-${pad(ultimo)}` };
}
