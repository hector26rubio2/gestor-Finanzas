import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en';
import es from './es';
import fr from './fr';
import pt from './pt';

type Catalogo = Record<string, string>;

const CATALOGOS: Record<string, Catalogo> = { es, en, fr, pt };
const [CAT_ES, CAT_EN, CAT_FR, CAT_PT] = [es, en, fr, pt] as Catalogo[];

const marcadores = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const etiquetas = (texto: string) => [...texto.matchAll(/<\/?[a-zA-Z][^>]*>/g)].map((m) => m[0]).sort();

function archivosDe(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre: string) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivosDe(ruta);
    return /\.(ts|html)$/.test(nombre) && !/\.spec\.ts$/.test(nombre) && !ruta.includes(join('core', 'i18n'))
      ? [ruta]
      : [];
  });
}

const RAIZ = join(process.cwd(), 'src', 'app');

describe('catálogos de idioma: nada queda sin traducir', () => {
  it('cada clave usa los mismos marcadores {x} en los cuatro idiomas', () => {
    const desiguales: string[] = [];
    for (const [clave, mensaje] of Object.entries(es)) {
      const esperados = marcadores(mensaje).join(',');
      for (const [idioma, catalogo] of Object.entries(CATALOGOS)) {
        const reales = marcadores(catalogo[clave] ?? '').join(',');
        if (reales !== esperados) desiguales.push(`${idioma}:${clave} (${reales} ≠ ${esperados})`);
      }
    }

    expect(desiguales, desiguales.join('\n')).toEqual([]);
  });

  it('ninguna clave se muestra a sí misma como texto', () => {
    const iguales: string[] = [];
    for (const [idioma, catalogo] of Object.entries(CATALOGOS))
      for (const [clave, mensaje] of Object.entries(catalogo))
        if (mensaje.trim() === clave) iguales.push(`${idioma}:${clave}`);

    expect(iguales, iguales.join('\n')).toEqual([]);
  });

  it('no quedan marcas de pendiente ni de traducción a medias', () => {
    const marcas = /(TODO|FIXME|XXX|TRADUCIR)|lorem ipsum|\[\[|\]\]/;
    const sospechosas: string[] = [];
    for (const [idioma, catalogo] of Object.entries(CATALOGOS))
      for (const [clave, mensaje] of Object.entries(catalogo))
        if (marcas.test(mensaje)) sospechosas.push(`${idioma}:${clave}`);

    expect(sospechosas, sospechosas.join('\n')).toEqual([]);
  });

  it('las etiquetas HTML de un mensaje son las mismas en todos los idiomas', () => {
    const desiguales: string[] = [];
    for (const [clave, mensaje] of Object.entries(es)) {
      const esperadas = etiquetas(mensaje).join('');
      for (const [idioma, catalogo] of Object.entries(CATALOGOS))
        if (etiquetas(catalogo[clave] ?? '').join('') !== esperadas) desiguales.push(`${idioma}:${clave}`);
    }

    expect(desiguales, desiguales.join('\n')).toEqual([]);
  });

  it('los textos no tienen espacios sobrantes en los bordes', () => {
    const sucias: string[] = [];
    for (const [idioma, catalogo] of Object.entries(CATALOGOS))
      for (const [clave, mensaje] of Object.entries(catalogo))
        if (mensaje !== mensaje.trim()) sucias.push(`${idioma}:${clave}`);

    expect(sucias, sucias.join('\n')).toEqual([]);
  });

  it('el idioma principal no repite los textos en inglés para dos claves de otro significado tal cual', () => {
    const iguales = Object.keys(es).filter(
      (clave) => CAT_FR[clave] === CAT_PT[clave] && CAT_FR[clave] === CAT_EN[clave] && CAT_FR[clave] !== CAT_ES[clave],
    );

    expect(iguales.length).toBeLessThan(Object.keys(es).length * 0.5);
  });
});

describe('claves que el código pide', () => {
  const codigo = archivosDe(RAIZ).map((ruta) => readFileSync(ruta, 'utf8'));
  const usadas = new Set<string>();
  for (const texto of codigo)
    for (const m of texto.matchAll(/\bt\(\s*['"`]([a-zA-Z][\w.]*\.[\w.]+)['"`]/g))
      if (!m[1].endsWith('.')) usadas.add(m[1]);

  it('el código usa muchas claves literales', () => {
    expect(usadas.size).toBeGreaterThan(500);
  });

  it('cada clave literal que pide el código existe en español', () => {
    const faltan = [...usadas].filter((clave) => !(clave in es)).sort();

    expect(faltan, `claves pedidas que no existen: ${faltan.join(', ')}`).toEqual([]);
  });

  it('y existe también en inglés, francés y portugués', () => {
    const faltan = [...usadas].filter((clave) => !(clave in en && clave in fr && clave in pt)).sort();

    expect(faltan, faltan.join(', ')).toEqual([]);
  });
});
