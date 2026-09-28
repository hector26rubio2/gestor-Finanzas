import { describe, expect, it } from 'vitest';
import en from './en';
import es from './es';
import fr from './fr';
import pt from './pt';

describe('catálogos de idioma', () => {
  const catalogos: Record<string, Record<string, string>> = { es, en, fr, pt };

  it('los cuatro catálogos tienen exactamente las mismas claves', () => {
    const clavesDeEs = Object.keys(es).sort();
    expect(clavesDeEs.length).toBeGreaterThan(1000);

    for (const [idioma, catalogo] of Object.entries(catalogos)) {
      const distintas = Object.keys(catalogo)
        .filter((clave) => !(clave in es))
        .concat(clavesDeEs.filter((clave) => !(clave in catalogo)))
        .sort();
      expect(distintas, `claves que sobran o faltan en ${idioma}: ${distintas.join(', ')}`).toEqual([]);
    }
  });

  it('ninguna clave queda con mensaje vacío', () => {
    for (const [idioma, catalogo] of Object.entries(catalogos)) {
      const vacias = Object.entries(catalogo)
        .filter(([, mensaje]) => !mensaje.trim())
        .map(([clave]) => clave);
      expect(vacias, `claves vacías en ${idioma}: ${vacias.join(', ')}`).toEqual([]);
    }
  });
});
