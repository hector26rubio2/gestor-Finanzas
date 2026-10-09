import { describe, expect, it } from 'vitest';
import { idiomaInicial } from './theme';

describe('idioma inicial de la sesión', () => {
  it('toma el primer idioma del navegador que la aplicación admite', () => {
    expect(idiomaInicial(['de-DE', 'pt-PT', 'en-US'])).toBe('pt-BR');
    expect(idiomaInicial(['fr'])).toBe('fr-FR');
    expect(idiomaInicial(['EN-us'])).toBe('en-US');
  });

  it('sin idioma admitido cae al español de Colombia', () => {
    expect(idiomaInicial(['ja-JP'])).toBe('es-CO');
    expect(idiomaInicial([])).toBe('es-CO');
  });
});
