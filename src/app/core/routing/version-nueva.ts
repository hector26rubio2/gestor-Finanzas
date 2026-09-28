import { ErrorHandler, Injectable } from '@angular/core';

const CLAVE_ULTIMA_RECARGA = 'finanzas.recargaPorVersion';
const ESPERA_ENTRE_RECARGAS_MS = 30_000;
let recargaEnCurso = false;

const MENSAJES_DE_CHUNK_PERDIDO = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'ChunkLoadError',
  'Loading chunk',
];

export function esChunkPerdido(error: unknown): boolean {
  const texto =
    error instanceof Error ? `${error.name} ${error.message}` : typeof error === 'string' ? error : String(error ?? '');
  return MENSAJES_DE_CHUNK_PERDIDO.some((mensaje) => texto.includes(mensaje));
}

function leerUltimaRecarga(almacen: Pick<Storage, 'getItem'>): number {
  try {
    return Number(almacen.getItem(CLAVE_ULTIMA_RECARGA)) || 0;
  } catch {
    return 0;
  }
}

export interface EntornoDeRecarga {
  ahora: () => number;
  almacen: Pick<Storage, 'getItem' | 'setItem'>;
  navegar: (url: string) => void;
  recargar: () => void;
}

function almacenDelNavegador(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.sessionStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {
        throw new Error('sessionStorage no disponible');
      },
    };
  }
}

const entornoDelNavegador = (): EntornoDeRecarga => ({
  ahora: () => Date.now(),
  almacen: almacenDelNavegador(),
  navegar: (url) => window.location.assign(url),
  recargar: () => window.location.reload(),
});

export function urlAbsoluta(rutaDelRouter: string): string {
  return new URL(rutaDelRouter.replace(/^\//, ''), document.baseURI).href;
}

export function recargarPorVersionNueva(destino?: string, entorno: EntornoDeRecarga = entornoDelNavegador()): boolean {
  const ahora = entorno.ahora();
  if (ahora - leerUltimaRecarga(entorno.almacen) < ESPERA_ENTRE_RECARGAS_MS) return false;
  try {
    entorno.almacen.setItem(CLAVE_ULTIMA_RECARGA, String(ahora));
  } catch {
    return false;
  }
  recargaEnCurso = true;
  if (destino) entorno.navegar(destino);
  else entorno.recargar();
  return true;
}

@Injectable()
export class FinanzasErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    if (esChunkPerdido(error) && (recargaEnCurso || recargarPorVersionNueva())) return;
    super.handleError(error);
  }
}
