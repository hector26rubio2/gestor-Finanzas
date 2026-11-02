import type { Account, Movement, ViewData } from '@core/state';
import {
  type InspectorFact,
  type InspectorFactsContext,
  hechosDeCuenta,
  hechosDeInversion,
  hechosDeMovimiento,
  hechosDePersona,
  hechosDelDia,
} from './inspector-facts';

type Persona = ViewData['people'][number];
type Inversion = ViewData['investments'][number];

export type EntidadResuelta =
  | { readonly tipo: 'movimiento'; readonly movimiento?: Movement }
  | { readonly tipo: 'cuenta'; readonly cuenta?: Account }
  | { readonly tipo: 'tarjeta'; readonly cuenta?: Account }
  | { readonly tipo: 'dia'; readonly fecha: string; readonly operaciones: number }
  | { readonly tipo: 'persona'; readonly persona?: Persona }
  | { readonly tipo: 'inversion'; readonly inversion?: Inversion };

export interface ContextoDePresentacion extends InspectorFactsContext {
  fechaLarga(iso: string): string;
  montoDe(cuenta: Account): number;
}

export interface Presentacion {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly monto: string;
  readonly hechos: readonly InspectorFact[];
}

const SIN_HECHOS: readonly InspectorFact[] = [];

function deCuenta(
  cuenta: Account | undefined,
  tituloGenerico: string,
  contexto: ContextoDePresentacion,
  conNombreEnTitulo: boolean,
): Presentacion {
  if (!cuenta)
    return { titulo: tituloGenerico, subtitulo: subtituloPorDefecto(contexto), monto: '', hechos: SIN_HECHOS };
  return {
    titulo: conNombreEnTitulo ? cuenta.name : tituloGenerico,
    subtitulo: cuenta.name,
    monto: contexto.money(contexto.montoDe(cuenta)),
    hechos: hechosDeCuenta(cuenta, contexto),
  };
}

const subtituloPorDefecto = (contexto: ContextoDePresentacion): string =>
  contexto.t('workspace.inspector.defaultSubtitle');

export function presentarEntidad(entidad: EntidadResuelta, contexto: ContextoDePresentacion): Presentacion {
  const { t, money } = contexto;
  switch (entidad.tipo) {
    case 'movimiento': {
      const titulo = t('workspace.inspector.title.movement');
      const movimiento = entidad.movimiento;
      if (!movimiento) return { titulo, subtitulo: subtituloPorDefecto(contexto), monto: '', hechos: SIN_HECHOS };
      return {
        titulo,
        subtitulo: movimiento.description,
        monto: money(movimiento.amount),
        hechos: hechosDeMovimiento(movimiento, contexto),
      };
    }
    case 'cuenta':
      return deCuenta(entidad.cuenta, t('workspace.inspector.title.account'), contexto, false);
    case 'tarjeta':
      return deCuenta(entidad.cuenta, t('workspace.inspector.title.card'), contexto, true);
    case 'dia':
      return {
        titulo: t('workspace.inspector.title.day', { date: contexto.fechaLarga(entidad.fecha) }),
        subtitulo: subtituloPorDefecto(contexto),
        monto: t('workspace.inspector.operationsCount', { count: entidad.operaciones }),
        hechos: hechosDelDia(entidad.fecha, entidad.operaciones, contexto),
      };
    case 'persona': {
      const persona = entidad.persona;
      if (!persona)
        return {
          titulo: t('workspace.inspector.title.person'),
          subtitulo: subtituloPorDefecto(contexto),
          monto: '',
          hechos: SIN_HECHOS,
        };
      return {
        titulo: persona.name,
        subtitulo: persona.name,
        monto: money(persona.owed - persona.owing),
        hechos: hechosDePersona(persona, contexto),
      };
    }
    case 'inversion': {
      const inversion = entidad.inversion;
      if (!inversion)
        return {
          titulo: t('workspace.inspector.title.investment'),
          subtitulo: subtituloPorDefecto(contexto),
          monto: '',
          hechos: SIN_HECHOS,
        };
      return {
        titulo: inversion.name,
        subtitulo: inversion.type,
        monto: money(inversion.value, inversion.currency),
        hechos: hechosDeInversion(inversion, contexto),
      };
    }
  }
}
