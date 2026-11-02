export type EntidadSeleccionada =
  | { readonly type: 'movement'; readonly id: string }
  | { readonly type: 'account'; readonly id: string }
  | { readonly type: 'card'; readonly id: string }
  | { readonly type: 'day'; readonly id: string }
  | { readonly type: 'person'; readonly id: string }
  | { readonly type: 'investment'; readonly id: string };

export type TipoDeEntidad = EntidadSeleccionada['type'];

export type EntidadInspeccionada = EntidadSeleccionada & { readonly previous?: EntidadSeleccionada };

const TIPOS: readonly TipoDeEntidad[] = ['movement', 'account', 'card', 'day', 'person', 'investment'];

export const esTipoDeEntidad = (valor: string): valor is TipoDeEntidad => TIPOS.some((tipo) => tipo === valor);

export function entidadSeleccionada(type: TipoDeEntidad, id: string): EntidadSeleccionada {
  return { type, id };
}
