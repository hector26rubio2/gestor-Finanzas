import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const SHIM_PNPM = /"\$basedir\/([^"]+?cli\/index\.js)"/;

export function cliGitnexus() {
  if (process.env.GITNEXUS_CLI && existsSync(process.env.GITNEXUS_CLI)) return process.env.GITNEXUS_CLI;
  for (const carpeta of (process.env.PATH ?? '').split(delimiter)) {
    const shim = join(carpeta, 'gitnexus');
    if (!existsSync(shim)) continue;
    const encontrado = readFileSync(shim, 'utf8').match(SHIM_PNPM);
    if (encontrado && existsSync(join(carpeta, encontrado[1]))) return join(carpeta, encontrado[1]);
  }
  const npmGlobal = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).stdout?.trim();
  const candidato = npmGlobal ? join(npmGlobal, 'gitnexus', 'dist', 'cli', 'index.js') : '';
  return candidato && existsSync(candidato) ? candidato : null;
}

export function gitnexus(args, opciones = {}) {
  const cli = cliGitnexus();
  if (!cli) throw new Error('No encuentro el CLI de gitnexus. Instálalo con: pnpm add -g gitnexus');
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...opciones,
  });
}

function valor(celda) {
  const limpio = celda.trim();
  if (limpio === '' || limpio === 'null') return null;
  return /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : limpio;
}

function tablaMarkdown(markdown) {
  const lineas = markdown.split('\n').filter((linea) => linea.startsWith('|'));
  if (lineas.length < 2) return [];
  const celdas = (linea) => linea.slice(1, -1).split(' | ');
  const columnas = celdas(lineas[0]).map((columna) => columna.trim());
  return lineas
    .slice(2)
    .map((linea) => Object.fromEntries(celdas(linea).map((celda, i) => [columnas[i], valor(celda)])));
}

export function cypher(repo, consulta) {
  const resultado = gitnexus(['cypher', consulta, '-r', repo, '-l', '1000000']);
  const inicio = resultado.stdout.indexOf('{');
  if (inicio < 0)
    throw new Error(`gitnexus cypher falló en ${repo}: ${(resultado.stderr || resultado.stdout).slice(0, 400)}`);
  const respuesta = JSON.parse(resultado.stdout.slice(inicio));
  if (Array.isArray(respuesta)) return respuesta;
  return tablaMarkdown(respuesta.markdown ?? '');
}

export function registro() {
  const ruta = join(homedir(), '.gitnexus', 'registry.json');
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : [];
}
