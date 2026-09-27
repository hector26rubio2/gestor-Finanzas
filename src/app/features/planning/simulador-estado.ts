import { WritableSignal } from '@angular/core';
import type { EscenarioGuardado, MedidaDeComparacion, VistaDeGrafica } from '@shared/proyecciones';
import type { AjusteDeLinea, CambioDeFlujo, Deuda, OrdenDeAbono } from '@shared/proyecciones';

export type AjusteDeDeuda = Partial<Pick<Deuda, 'saldo' | 'tasaMensual' | 'cuotas'>>;

export type EventoDelEscenario =
  | {
      readonly tipo: 'abono';
      readonly id: string;
      readonly deudaId: string;
      readonly mes: number;
      readonly monto: number;
    }
  | {
      readonly tipo: 'tasa';
      readonly id: string;
      readonly deudaId: string;
      readonly mes: number;
      readonly tasaMensual: number;
    };

export interface EstadoGuardado {
  readonly version: number;
  readonly recorte?: number;
  readonly ajustesDeLinea?: Readonly<Record<string, AjusteDeLinea>>;
  readonly recurrentesQuitados?: readonly string[];
  readonly cambiosDeFlujo?: readonly CambioDeFlujo[];
  readonly vista?: VistaDeGrafica;
  readonly medidaDeComparacion?: MedidaDeComparacion;
  readonly escenariosGuardados?: readonly EscenarioGuardado[];
  readonly ajustes?: Readonly<Record<string, AjusteDeDeuda>>;
  readonly excluidas?: readonly string[];
  readonly hipoteticas?: readonly Deuda[];
  readonly abonoMensual?: number;
  readonly orden?: OrdenDeAbono;
  readonly eventos?: readonly EventoDelEscenario[];
  readonly fechaSinDeudas?: string;
  readonly compra?: { monto: number; nombre: string; cuotas: number; tasa: number; mes: number };
  readonly meta?: { monto: number; fecha: string };
  readonly inversion?: { inicial: number; aporte: number; tasa: number; fecha: string };
}

export interface SenalesDelSimulador {
  readonly recorte: WritableSignal<number>;
  readonly ajustesDeLinea: WritableSignal<Readonly<Record<string, AjusteDeLinea>>>;
  readonly recurrentesQuitados: WritableSignal<ReadonlySet<string>>;
  readonly cambiosDeFlujo: WritableSignal<readonly CambioDeFlujo[]>;
  readonly vista: WritableSignal<VistaDeGrafica>;
  readonly medidaDeComparacion: WritableSignal<MedidaDeComparacion>;
  readonly escenariosGuardados: WritableSignal<readonly EscenarioGuardado[]>;
  readonly ajustes: WritableSignal<Readonly<Record<string, AjusteDeDeuda>>>;
  readonly excluidas: WritableSignal<ReadonlySet<string>>;
  readonly hipoteticas: WritableSignal<readonly Deuda[]>;
  readonly abonoMensual: WritableSignal<number>;
  readonly orden: WritableSignal<OrdenDeAbono>;
  readonly eventos: WritableSignal<readonly EventoDelEscenario[]>;
  readonly fechaSinDeudas: WritableSignal<string>;
  readonly compraMonto: WritableSignal<number>;
  readonly compraNombre: WritableSignal<string>;
  readonly compraCuotas: WritableSignal<number>;
  readonly compraTasa: WritableSignal<number>;
  readonly compraMes: WritableSignal<number>;
  readonly metaMonto: WritableSignal<number>;
  readonly metaFecha: WritableSignal<string>;
  readonly inversionInicial: WritableSignal<number>;
  readonly inversionAporte: WritableSignal<number>;
  readonly inversionTasa: WritableSignal<number>;
  readonly inversionFecha: WritableSignal<string>;
}

export function serializarEstado(s: SenalesDelSimulador): string {
  return JSON.stringify({
    version: 1,
    recorte: s.recorte(),
    ajustesDeLinea: s.ajustesDeLinea(),
    recurrentesQuitados: [...s.recurrentesQuitados()],
    cambiosDeFlujo: s.cambiosDeFlujo(),
    vista: s.vista(),
    medidaDeComparacion: s.medidaDeComparacion(),
    escenariosGuardados: s.escenariosGuardados(),
    ajustes: s.ajustes(),
    excluidas: [...s.excluidas()],
    hipoteticas: s.hipoteticas(),
    abonoMensual: s.abonoMensual(),
    orden: s.orden(),
    eventos: s.eventos(),
    fechaSinDeudas: s.fechaSinDeudas(),
    compra: {
      monto: s.compraMonto(),
      nombre: s.compraNombre(),
      cuotas: s.compraCuotas(),
      tasa: s.compraTasa(),
      mes: s.compraMes(),
    },
    meta: { monto: s.metaMonto(), fecha: s.metaFecha() },
    inversion: {
      inicial: s.inversionInicial(),
      aporte: s.inversionAporte(),
      tasa: s.inversionTasa(),
      fecha: s.inversionFecha(),
    },
  } satisfies EstadoGuardado);
}

export function leerEstado(json: string | null): EstadoGuardado | null {
  if (!json) return null;
  try {
    const guardado = JSON.parse(json) as EstadoGuardado;
    return guardado?.version === 1 ? guardado : null;
  } catch {
    return null;
  }
}

export function aplicarEstado(s: SenalesDelSimulador, guardado: EstadoGuardado): void {
  s.recorte.set(guardado.recorte ?? 0);
  s.ajustesDeLinea.set(guardado.ajustesDeLinea ?? {});
  s.recurrentesQuitados.set(new Set(guardado.recurrentesQuitados ?? []));
  s.cambiosDeFlujo.set(guardado.cambiosDeFlujo ?? []);
  s.vista.set(guardado.vista ?? 'original');
  s.medidaDeComparacion.set(guardado.medidaDeComparacion ?? 'saldoTotal');
  s.escenariosGuardados.set(guardado.escenariosGuardados ?? []);
  s.ajustes.set(guardado.ajustes ?? {});
  s.excluidas.set(new Set(guardado.excluidas ?? []));
  s.hipoteticas.set(guardado.hipoteticas ?? []);
  s.abonoMensual.set(guardado.abonoMensual ?? 0);
  s.orden.set(guardado.orden ?? 'tasa');
  s.eventos.set(guardado.eventos ?? []);
  if (guardado.fechaSinDeudas) s.fechaSinDeudas.set(guardado.fechaSinDeudas);
  if (guardado.compra) {
    s.compraMonto.set(guardado.compra.monto);
    s.compraNombre.set(guardado.compra.nombre);
    s.compraCuotas.set(guardado.compra.cuotas);
    s.compraTasa.set(guardado.compra.tasa);
    s.compraMes.set(guardado.compra.mes);
  }
  if (guardado.meta) {
    s.metaMonto.set(guardado.meta.monto);
    s.metaFecha.set(guardado.meta.fecha);
  }
  if (guardado.inversion) {
    s.inversionInicial.set(guardado.inversion.inicial);
    s.inversionAporte.set(guardado.inversion.aporte);
    s.inversionTasa.set(guardado.inversion.tasa);
    s.inversionFecha.set(guardado.inversion.fecha);
  }
}
