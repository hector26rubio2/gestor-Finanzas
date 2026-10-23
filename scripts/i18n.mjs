/**
 * Generador de catálogos i18n a partir de `en.ts` como fuente única.
 *
 * Uso:
 *   node scripts/i18n.mjs           # regenera los 4 diccionarios (falla si faltan claves)
 *   node scripts/i18n.mjs --check   # falla si algún diccionario difiere de lo generado (uso en CI)
 *
 * `en.ts` es el maestro: define el listado y el orden de claves. El generador
 * reescribe en/es/fr/pt con las mismas claves en el mismo orden, conservando
 * el valor de cada idioma. Las claves consumidas por i18n.service.ts no cambian.
 * Si todas las claves del maestro están presentes en los 4 idiomas, el flujo es:
 * editar `en.ts` (u otro catálogo) → `pnpm i18n:gen`.
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
  const body = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
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
  const lines = body.split('\n').filter((line) => line.trim().startsWith("'") || line.trim() === '');
  let pendiente = lines[0]?.trim() === '';
  for (const line of lines) {
    const clave = line.trim().startsWith("'")
      ? line.trim().match(/^(['"])(.+?)\1/)?.[2]
      : undefined;
    if (clave === undefined) {
      pendiente = true;
      continue;
    }
    if (pendiente) blankBefore.add(clave);
    pendiente = false;
  }
  return { file, catalog, source, blankBefore };
}

/**
 * Serializa una cadena igual que Prettier: comillas simples, salvo cuando
 * escaparlas cuesta igual o más que usar dobles (empate → dobles).
 */
function formatValue(value) {
  const single = `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`;
  const escapesSimple = (value.match(/'/g) ?? []).length;
  const escapesDouble = (value.match(/"/g) ?? []).length;
  const esNecesariasSimples = escapesSimple > 0 && escapesDouble >= escapesSimple;
  if (escapesSimple === 0 || esNecesariasSimples) {
    if (escapesSimple === 0) return single;
  }
  return escapesDouble <= escapesSimple ? JSON.stringify(value) : single;
}

function renderCatalog(entries, blankBefore) {
  const lines = entries.map(([key, value]) => {
    const entrada = `  ${formatValue(key)}: ${formatValue(value)},`;
    return blankBefore.has(key) ? `\n${entrada}` : entrada;
  });
  return `export default {\n${lines.join('\n')}\n} as const;\n`;
}

const prettier = await import('prettier');
// Opciones espejo de `.prettierrc` del repo.
const prettierConfig = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
};

const read = Object.fromEntries(LANGUAGES.map((language) => [language, readCatalog(language)]));
const masterKeys = Object.keys(read[MASTER].catalog);
const masterSet = new Set(masterKeys);

// Paridad: claves que faltan en algún idioma.
const missing = [];
for (const language of LANGUAGES) {
  const keys = new Set(Object.keys(read[language].catalog));
  const faltantes = masterKeys.filter((key) => !keys.has(key));
  if (faltantes.length > 0) {
    missing.push([language, faltantes]);
  }
}
if (missing.length > 0) {
  const detalle = missing
    .map(([language, keys]) => `  ${language}.ts (${keys.length}): ${keys.join(', ')}`)
    .join('\n');
  console.error(
    `Error: el maestro ${MASTER}.ts tiene claves que no existen en otros catálogos.\n` +
      `Completa estos valores antes de generar:\n${detalle}`,
  );
  process.exit(1);
}

// Claves fuera del maestro (en otros idiomas pero no en en.ts).
const extras = [];
for (const language of LANGUAGES) {
  if (language === MASTER) continue;
  const sobrantes = Object.keys(read[language].catalog).filter((key) => !masterSet.has(key));
  if (sobrantes.length > 0) {
    extras.push([language, sobrantes]);
  }
}
if (extras.length > 0) {
  const detalle = extras
    .map(([language, keys]) => `  ${language}.ts (${keys.length}): ${keys.join(', ')}`)
    .join('\n');
  console.error(
    `Error: claves que no existen en el maestro ${MASTER}.ts.\n` +
      `Elimínalas o agrégalas al maestro:\n${detalle}`,
  );
  process.exit(1);
}

let changed = [];
for (const language of LANGUAGES) {
  const entries = masterKeys.map((key) => [key, read[language].catalog[key]]);
  let rendered = renderCatalog(entries, read[MASTER].blankBefore);
  rendered = await prettier.format(rendered, {
    ...prettierConfig,
    parser: 'typescript',
    filepath: read[language].file,
  });
  if (rendered !== read[language].source) {
    if (!checkOnly) {
      fs.writeFileSync(read[language].file, rendered, 'utf8');
    }
    changed.push(language);
  }
}

if (checkOnly) {
  if (changed.length > 0) {
    console.error(
      `Error: los catálogos no coinciden con lo generado (${changed.join(', ')}). ` +
        `Ejecuta \`pnpm i18n:gen\` y sube el resultado.`,
    );
    process.exit(1);
  }
  console.log(
    `OK: ${masterKeys.length} claves por idioma coherentes con el maestro ${MASTER}.ts en ${LANGUAGES.length} catálogos.`,
  );
} else {
  console.log(
    changed.length > 0
      ? `Regenerados ${changed.join(', ')} (${masterKeys.length} claves, maestro ${MASTER}.ts).`
      : `Sin cambios (${masterKeys.length} claves, maestro ${MASTER}.ts).`,
  );
}
