/**
 * Normalizador de los 4 catálogos i18n (en, es, fr, pt).
 *
 * Uso:
 *   node scripts/i18n.mjs           # reordena y reformatea los 4 diccionarios (falla si hay paridad rota)
 *   node scripts/i18n.mjs --check   # falla si algún diccionario difiere de lo generado (uso en CI)
 *
 * Los valores se editan a mano en los 4 archivos (un valor por idioma, sin
 * defaults generados). `en.ts` actúa como maestro de forma: define la lista y el
 * orden de claves; el generador reescribe los 4 archivos con las mismas claves
 * en el mismo orden, conservando el valor de cada idioma y el agrupado de
 * secciones del maestro. El shape del objeto exportado no cambia, así que
 * i18n.service.ts y sus consumidores quedan intactos.
 *
 * Flujo para una clave nueva (4 ediciones + check):
 *   1. agrega la clave con su valor en en.ts, es.ts, fr.ts y pt.ts,
 *   2. corre `pnpm i18n:gen` (normaliza orden y formato; falla si falta o sobra
 *      alguna clave en algún idioma, listándolas),
 *   3. en CI, `pnpm i18n:check` falla si los archivos difieren de lo generado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogDir = path.join(root, 'src', 'app', 'core', 'i18n');
const LANGUAGES = ['en', 'es', 'fr', 'pt'];
const MASTER = 'en';
const checkOnly = process.argv.includes('--check');

function readCatalog(language) {
  const file = path.join(catalogDir, `${language}.ts`);
  const source = fs.readFileSync(file, 'utf8');
  // Se evalúa con los comentarios intactos: quitarlos con regex podría comerse
  // contenido de valores que contengan `//` o `/*`. Sobra con retirar el
  // `export default`, el `as const` y el punto y coma final.
  const body = source
    .replace(/^\s*export default\s*/m, '')
    .replace(/as const\s*;?\s*$/, '')
    .trim()
    .replace(/;$/, '');
  const catalog = new Function(`"use strict"; return (${body});`)();
  if (!catalog || typeof catalog !== 'object') {
    throw new Error(`El catálogo ${language}.ts no exporta un objeto plano.`);
  }
  // ¿La fuente deja una línea en blanco antes de cada clave? Se respeta para
  // conservar el agrupado visual de secciones.
  const blankBefore = new Set();
  let despuesDeLineaEnBlanco = true;
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(['"])(.+?)\1\s*:/);
    if (m) {
      if (despuesDeLineaEnBlanco) blankBefore.add(m[2]);
      despuesDeLineaEnBlanco = false;
    } else if (line.trim() === '') {
      despuesDeLineaEnBlanco = true;
    }
  }
  return { file, catalog, source, blankBefore };
}

/**
 * Serializa una cadena igual que Prettier: escapa siempre `\`, `\r`, `\n` y la
 * comilla elegida; elige comillas simples, salvo que escapar las dobles cueste
 * igual o menos (empate → dobles).
 */
function formatValue(value) {
  const comillasSimples = `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`;
  if (!value.includes("'")) return comillasSimples;
  const escapesSimples = (value.match(/'/g) ?? []).length;
  const escapesDobles = (value.match(/"/g) ?? []).length;
  return escapesDobles <= escapesSimples ? JSON.stringify(value) : comillasSimples;
}

function renderCatalog(entries, blankBefore) {
  const lines = entries.map(([key, value]) => {
    const entrada = `  ${formatValue(key)}: ${formatValue(value)},`;
    return blankBefore.has(key) ? `\n${entrada}` : entrada;
  });
  return `export default {\n${lines.join('\n')}\n} as const;\n`;
}

const catalogos = Object.fromEntries(LANGUAGES.map((language) => [language, readCatalog(language)]));
const masterKeys = Object.keys(catalogos[MASTER].catalog);
const masterSet = new Set(masterKeys);

// Paridad: claves que faltan en algún idioma y claves sin lugar en el maestro.
const faltantesPorIdioma = LANGUAGES.map((language) => {
  const keys = new Set(Object.keys(catalogos[language].catalog));
  return { language, faltantes: masterKeys.filter((key) => !keys.has(key)) };
}).filter((r) => r.faltantes.length > 0);
const sobrantesPorIdioma = LANGUAGES.filter((language) => language !== MASTER)
  .map((language) => ({
    language,
    sobrantes: Object.keys(catalogos[language].catalog).filter((key) => !masterSet.has(key)),
  }))
  .filter((r) => r.sobrantes.length > 0);

function detallePorIdioma(detalles) {
  return detalles
    .map(({ language, ...resto }) => {
      const [claves] = Object.values(resto);
      return `  ${language}.ts (${claves.length}): ${claves.join(', ')}`;
    })
    .join('\n');
}
function fallaPorIdiomas(detalles, mensaje) {
  console.error(`${mensaje}:\n${detallePorIdioma(detalles)}`);
  process.exit(1);
}
if (faltantesPorIdioma.length > 0) {
  fallaPorIdiomas(
    faltantesPorIdioma,
    `Error: el maestro ${MASTER}.ts tiene claves que no existen en otros catálogos. ` +
      'Completa estos valores antes de generar',
  );
}
if (sobrantesPorIdioma.length > 0) {
  fallaPorIdiomas(
    sobrantesPorIdioma,
    `Error: claves que no existen en el maestro ${MASTER}.ts. ` +
      'Elimínalas o agrégalas al maestro',
  );
}

const prettier = await import('prettier');
const prettierConfig =
  (await prettier.resolveConfig(catalogos[MASTER].file)) ?? {
    semi: true,
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 120,
    tabWidth: 2,
    arrowParens: 'always',
    endOfLine: 'auto',
  };

const modificados = [];
for (const language of LANGUAGES) {
  const entries = masterKeys.map((key) => [key, catalogos[language].catalog[key]]);
  let rendered = renderCatalog(entries, catalogos[MASTER].blankBefore);
  rendered = await prettier.format(rendered, {
    ...prettierConfig,
    parser: 'typescript',
    filepath: catalogos[language].file,
  });
  if (rendered !== catalogos[language].source) {
    if (!checkOnly) {
      fs.writeFileSync(catalogos[language].file, rendered, 'utf8');
    }
    modificados.push(language);
  }
}

if (checkOnly) {
  if (modificados.length > 0) {
    console.error(
      `Error: los catálogos no coinciden con lo generado (${modificados.join(', ')}). ` +
        `Ejecuta \`pnpm i18n:gen\` y sube el resultado.`,
    );
    process.exit(1);
  }
  console.log(
    `OK: ${masterKeys.length} claves por idioma coherentes con el maestro ${MASTER}.ts en ${LANGUAGES.length} catálogos.`,
  );
} else {
  console.log(
    modificados.length > 0
      ? `Regenerados ${modificados.join(', ')} (${masterKeys.length} claves, maestro ${MASTER}.ts).`
      : `Sin cambios (${masterKeys.length} claves, maestro ${MASTER}.ts).`,
  );
}
