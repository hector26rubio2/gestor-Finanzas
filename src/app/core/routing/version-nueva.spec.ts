import { describe, expect, it, vi } from 'vitest';
import { EntornoDeRecarga, esChunkPerdido, recargarPorVersionNueva } from './version-nueva';

function entorno(ahora: number, guardado: string | null = null) {
  const datos = new Map<string, string>();
  if (guardado !== null) datos.set('finanzas.recargaPorVersion', guardado);
  const e: EntornoDeRecarga = {
    ahora: () => ahora,
    almacen: { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) },
    navegar: vi.fn(),
    recargar: vi.fn(),
  };
  return e;
}

describe('recarga por versión nueva', () => {
  it('reconoce el chunk perdido en Chrome, Firefox y Safari', () => {
    expect(
      esChunkPerdido(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-DlB02a3z2.js')),
    ).toBe(true);
    expect(esChunkPerdido(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(esChunkPerdido(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(esChunkPerdido(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(esChunkPerdido(null)).toBe(false);
  });

  it('recarga en la ruta pedida la primera vez', () => {
    const e = entorno(100_000);
    expect(recargarPorVersionNueva('https://app/dashboard', e)).toBe(true);
    expect(e.navegar).toHaveBeenCalledWith('https://app/dashboard');
  });

  it('sin ruta recarga la página actual', () => {
    const e = entorno(100_000);
    recargarPorVersionNueva(undefined, e);
    expect(e.recargar).toHaveBeenCalledOnce();
  });

  it('no entra en bucle si la versión nueva tampoco carga', () => {
    const e = entorno(100_000, String(100_000 - 5_000));
    expect(recargarPorVersionNueva(undefined, e)).toBe(false);
    expect(e.recargar).not.toHaveBeenCalled();
  });

  it('vuelve a recargar si ya pasó un rato desde la última vez', () => {
    const e = entorno(100_000, String(100_000 - 60_000));
    expect(recargarPorVersionNueva(undefined, e)).toBe(true);
  });

  it('sin almacenamiento disponible no recarga, para no arriesgar un bucle', () => {
    const e = entorno(100_000);
    e.almacen = {
      getItem: () => null,
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(recargarPorVersionNueva(undefined, e)).toBe(false);
  });
});
