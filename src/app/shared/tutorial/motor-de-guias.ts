import type { AccionDeGuia, EntidadDeGuia, FormularioDeGuia, Guia } from './catalogo-de-guias';

export interface TiemposDelMotor {
  trasAccion: number;
  sinAccion: number;
}

export const TIEMPOS_DEL_MOTOR: TiemposDelMotor = { trasAccion: 4000, sinAccion: 1500 };

export interface EntornoDelMotor {
  seccionActual(): string;
  navegar(ruta: string, params?: Readonly<Record<string, string>>): Promise<void>;
  abrirFormulario(accion: Extract<AccionDeGuia, { tipo: 'abrirFormulario' }>): boolean | Promise<boolean>;
  inspeccionar(entidad: EntidadDeGuia): boolean | Promise<boolean>;
  cerrarFormulario(): void | Promise<void>;
  cerrarInspector(): void;
  clic(selector: string): boolean;
  escape(): void;
  existe(selector: string): boolean;
  esperar(selector: string, milisegundos: number): Promise<boolean>;
}

export interface SesionDeGuia {
  primero(): Promise<number | null>;
  siguiente(indice: number): Promise<number | null>;
  anterior(indice: number): Promise<number | null>;
  cerrar(): void;
  readonly terminada: boolean;
}

export type { FormularioDeGuia };

const comoLista = (antes: unknown): AccionDeGuia[] =>
  antes === undefined ? [] : ((Array.isArray(antes) ? antes : [antes]) as AccionDeGuia[]);

export function crearSesionDeGuia(
  guia: Guia,
  entorno: EntornoDelMotor,
  tiempos: TiemposDelMotor = TIEMPOS_DEL_MOTOR,
): SesionDeGuia {
  const preparados = new Set<number>();
  const activos = new Map<string, string>();
  let formularioAbierto = false;
  let inspectorAbierto = false;
  let terminada = false;
  let arrancada = false;

  async function ejecutar(accion: AccionDeGuia): Promise<boolean> {
    switch (accion.tipo) {
      case 'navegar':
        await entorno.navegar(accion.ruta, accion.params);
        return true;
      case 'abrirFormulario': {
        const abierto = await entorno.abrirFormulario(accion);
        formularioAbierto = formularioAbierto || abierto;
        return abierto;
      }
      case 'inspeccionar': {
        const abierto = await entorno.inspeccionar(accion.entidad);
        inspectorAbierto = inspectorAbierto || abierto;
        return abierto;
      }
      case 'clic': {
        if (accion.deshacer && activos.has(accion.selector)) return true;
        const hecho = entorno.clic(accion.selector);
        if (hecho && accion.deshacer) activos.set(accion.selector, accion.deshacer);
        return hecho;
      }
      case 'cerrar':
        await entorno.cerrarFormulario();
        entorno.cerrarInspector();
        formularioAbierto = false;
        inspectorAbierto = false;
        return true;
    }
  }

  async function preparar(indice: number, retroceso: boolean): Promise<boolean> {
    const paso = guia.pasos[indice];
    const acciones = comoLista(paso.antes);
    const pendientes = !preparados.has(indice) || (retroceso && !entorno.existe(paso.selector));
    const ejecutarAcciones = acciones.length > 0 && pendientes;
    if (ejecutarAcciones) for (const accion of acciones) if (!(await ejecutar(accion))) return false;
    preparados.add(indice);
    if (paso.esperar === false) return entorno.existe(paso.selector);
    return entorno.esperar(paso.selector, ejecutarAcciones ? tiempos.trasAccion : tiempos.sinAccion);
  }

  async function buscar(desde: number, sentido: 1 | -1): Promise<number | null> {
    for (let i = desde; i >= 0 && i < guia.pasos.length; i += sentido) if (await preparar(i, sentido === -1)) return i;
    return null;
  }

  return {
    async primero() {
      arrancada = true;
      if (entorno.seccionActual() !== guia.ruta) await entorno.navegar(guia.ruta);
      return buscar(0, 1);
    },
    async siguiente(indice) {
      const destino = await buscar(indice + 1, 1);
      if (destino === null) terminada = true;
      return destino;
    },
    anterior: (indice) => buscar(indice - 1, -1),
    cerrar() {
      if (!arrancada) return;
      arrancada = false;
      for (const deshacer of [...activos.values()].reverse()) {
        if (deshacer === 'escape') entorno.escape();
        else if (entorno.existe(deshacer)) entorno.clic(deshacer);
      }
      activos.clear();
      if (formularioAbierto) entorno.cerrarFormulario();
      if (inspectorAbierto) entorno.cerrarInspector();
      formularioAbierto = false;
      inspectorAbierto = false;
    },
    get terminada() {
      return terminada;
    },
  };
}
