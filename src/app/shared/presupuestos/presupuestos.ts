import type { ApiBudget, ApiCategory } from '@core/api';
import { decimalsFor, parseMoney } from '@core/utils/money';

type NivelDePresupuesto = 'ok' | 'alerta' | 'excedido';

export interface EstadoDePresupuesto {
  readonly porcentaje: number;
  readonly nivel: NivelDePresupuesto;
  readonly diferencia: number;
}

export interface FilaDePresupuesto {
  readonly categoria: ApiCategory;
  readonly limite: number | null;
  readonly gastado: number;
  readonly estado: EstadoDePresupuesto | null;
  readonly monedaAjena: string | null;
}

export interface EntradaDeFilas {
  readonly categorias: readonly ApiCategory[];
  readonly presupuestos: readonly ApiBudget[];
  readonly gastoPorCategoria: ReadonlyMap<string, number>;
  readonly monedaBase: string;
}

const TIPO_DE_GASTO = 2;
const UMBRAL_DE_ALERTA = 80;

export function estadoDelPresupuesto(gastado: number, limite: number): EstadoDePresupuesto {
  const porcentaje = limite > 0 ? Math.round((gastado / limite) * 100) : 0;
  const nivel: NivelDePresupuesto = porcentaje > 100 ? 'excedido' : porcentaje >= UMBRAL_DE_ALERTA ? 'alerta' : 'ok';
  return { porcentaje, nivel, diferencia: limite - gastado };
}

export function filasDePresupuesto(entrada: EntradaDeFilas): FilaDePresupuesto[] {
  const base = entrada.monedaBase.trim().toUpperCase();
  const porCategoria = new Map(entrada.presupuestos.map((presupuesto) => [presupuesto.category.id, presupuesto]));
  return entrada.categorias
    .filter((categoria) => categoria.type === TIPO_DE_GASTO && categoria.isActive)
    .map((categoria) => {
      const presupuesto = porCategoria.get(categoria.id);
      const gastado = entrada.gastoPorCategoria.get(categoria.name) ?? 0;
      if (!presupuesto) return { categoria, limite: null, gastado, estado: null, monedaAjena: null };
      const moneda = presupuesto.monthlyLimit.currency.trim().toUpperCase();
      if (moneda !== base) return { categoria, limite: null, gastado, estado: null, monedaAjena: moneda };
      const limite = parseMoney(presupuesto.monthlyLimit);
      return { categoria, limite, gastado, estado: estadoDelPresupuesto(gastado, limite), monedaAjena: null };
    })
    .sort(
      (a, b) =>
        Number(b.limite !== null) - Number(a.limite !== null) ||
        (b.estado?.porcentaje ?? 0) - (a.estado?.porcentaje ?? 0) ||
        a.categoria.name.localeCompare(b.categoria.name),
    );
}

export function limiteDeTexto(texto: string, moneda: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+([.,]\d+)?$/.test(limpio)) return null;
  const valor = Number(limpio.replace(',', '.'));
  const decimales = decimalsFor(moneda);
  const redondeado = Number(valor.toFixed(decimales));
  return Number.isFinite(redondeado) && redondeado > 0 ? redondeado : null;
}

export function montoDeApi(valor: number, moneda: string): string {
  return valor.toFixed(decimalsFor(moneda));
}
