import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './return-url';

describe('safeReturnPath', () => {
  it('acepta una ruta interna con su consulta', () => {
    expect(safeReturnPath('/movements')).toBe('/movements');
    expect(safeReturnPath('/movements?pagina=3')).toBe('/movements?pagina=3');
  });

  it('rechaza lo que no es una ruta de esta aplicación', () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath('')).toBeNull();
    expect(safeReturnPath('https://otro.example/x')).toBeNull();
    expect(safeReturnPath('//otro.example/x')).toBeNull();
    expect(safeReturnPath('/\\otro.example')).toBeNull();
    expect(safeReturnPath('movements')).toBeNull();
  });

  it('no devuelve al login ni a la pantalla de sin acceso', () => {
    expect(safeReturnPath('/login')).toBeNull();
    expect(safeReturnPath('/login?returnUrl=%2Fmovements')).toBeNull();
    expect(safeReturnPath('/sin-acceso')).toBeNull();
    expect(safeReturnPath('/')).toBeNull();
  });
});
