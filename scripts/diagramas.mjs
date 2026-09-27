import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportarContratos } from './atlas/contratos.mjs';
import { cliGitnexus, gitnexus, registro } from './atlas/gitnexus.mjs';
import { exportarGrafo } from './atlas/grafo.mjs';
import { construirPortal } from './atlas/portal.mjs';

const REPO_FRONT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = join(REPO_FRONT, 'docs', 'diagramas');
const MANIFIESTO = join(CARPETA, 'manifiesto.json');
const HUELLAS = join(CARPETA, 'huellas.json');
const VERIFICACION = join(CARPETA, '.verificacion');
const DATOS = join(CARPETA, 'datos');
const GRAFO = join(DATOS, 'grafo.json');
const CONTRATOS = join(DATOS, 'contratos.json');
const PORTAL = join(CARPETA, 'index.html');
const REPOS_GITNEXUS = { web: 'gestor-Finanzas', api: 'v2-api-finanzas' };
const GRUPO_GITNEXUS = 'finanzas';
const ARCHIFY = process.env.ARCHIFY_DIR ?? join(homedir(), '.claude', 'skills', 'archify');
const PRUEBAS = /\.spec\.ts$|[\\/]tests?[\\/]/;
const MUTACIONES_GIT = /\bgit\s+(commit|merge|pull|rebase|checkout|switch|cherry-pick|reset|stash\s+pop)\b/;

function raices() {
  return {
    front: REPO_FRONT,
    api: resolve(process.env.FINANZAS_API_DIR ?? join(REPO_FRONT, '..', 'v2-api-finanzas')),
  };
}

function leerJson(ruta, respaldo) {
  if (!existsSync(ruta)) return respaldo;
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

function escribirJson(ruta, valor) {
  writeFileSync(ruta, `${JSON.stringify(valor, null, 2)}\n`, 'utf8');
}

function manifiesto() {
  return leerJson(MANIFIESTO, { diagramas: [] });
}

function hashDe(texto) {
  return createHash('sha256').update(texto).digest('hex').slice(0, 16);
}

function archivosDe(fuentes) {
  const bases = raices();
  const encontrados = new Map();
  const faltan = [];
  for (const [repo, patrones] of Object.entries(fuentes)) {
    const base = bases[repo];
    if (!base || !existsSync(base)) {
      faltan.push(repo);
      continue;
    }
    for (const patron of patrones) {
      for (const ruta of globSync(patron, { cwd: base }).filter((ruta) => !PRUEBAS.test(ruta))) {
        const absoluta = join(base, ruta);
        const contenido = readFileSync(absoluta, 'utf8').replace(/\r\n/g, '\n');
        encontrados.set(`${repo}:${ruta.replace(/\\/g, '/')}`, hashDe(contenido));
      }
    }
  }
  return { archivos: Object.fromEntries([...encontrados].sort(([a], [b]) => a.localeCompare(b))), faltan };
}

function huellaDe(diagrama) {
  const spec = readFileSync(join(CARPETA, diagrama.spec), 'utf8').replace(/\r\n/g, '\n');
  const { archivos, faltan } = archivosDe(diagrama.fuentes);
  return { spec: hashDe(spec), archivos, faltan };
}

function diferencias(anteriores, actuales) {
  const cambiados = [];
  for (const [ruta, hash] of Object.entries(actuales)) {
    if (!(ruta in anteriores)) cambiados.push(`+ ${ruta}`);
    else if (anteriores[ruta] !== hash) cambiados.push(`~ ${ruta}`);
  }
  for (const ruta of Object.keys(anteriores)) if (!(ruta in actuales)) cambiados.push(`- ${ruta}`);
  return cambiados;
}

function estado() {
  const huellas = leerJson(HUELLAS, {});
  return manifiesto().diagramas.map((diagrama) => {
    const actual = huellaDe(diagrama);
    const sello = huellas[diagrama.id];
    const reposSinRevisar = actual.faltan;
    if (!sello) return { diagrama, situacion: 'sin-sellar', cambiados: [], reposSinRevisar };
    const fuentesRevisables = Object.fromEntries(
      Object.entries(sello.archivos).filter(([ruta]) => !reposSinRevisar.includes(ruta.split(':')[0])),
    );
    const cambiados = diferencias(fuentesRevisables, actual.archivos);
    const specCambiado = sello.spec !== actual.spec;
    const html = join(CARPETA, diagrama.html);
    let situacion = 'al-dia';
    if (cambiados.length) situacion = 'codigo-cambio';
    else if (specCambiado || !existsSync(html)) situacion = 'sin-generar';
    return { diagrama, situacion, cambiados, reposSinRevisar };
  });
}

const ETIQUETAS = {
  'al-dia': 'al día',
  'codigo-cambio': 'el código cambió',
  'sin-generar': 'spec editado sin generar',
  'sin-sellar': 'nunca sellado',
};

function imprimirEstado(filas, detalle) {
  const pendientes = filas.filter((fila) => fila.situacion !== 'al-dia');
  for (const fila of filas) {
    const marca = fila.situacion === 'al-dia' ? 'ok ' : '!! ';
    console.log(`${marca}${fila.diagrama.id.padEnd(34)} ${ETIQUETAS[fila.situacion]}`);
    if (detalle) for (const ruta of fila.cambiados.slice(0, 12)) console.log(`      ${ruta}`);
    if (detalle && fila.cambiados.length > 12) console.log(`      … ${fila.cambiados.length - 12} más`);
    if (fila.reposSinRevisar.length)
      console.log(`      sin revisar: repo ${fila.reposSinRevisar.join(', ')} no encontrado`);
  }
  console.log(
    pendientes.length ? `\n${pendientes.length} diagrama(s) pendientes.` : '\nTodos los diagramas están al día.',
  );
  return pendientes;
}

function archify(args) {
  const resultado = spawnSync(process.execPath, [join(ARCHIFY, 'bin', 'archify.mjs'), ...args, '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    return JSON.parse(resultado.stdout);
  } catch {
    return {
      ok: false,
      diagnostics: [{ code: 'archify/salida', message: (resultado.stderr || resultado.stdout).slice(0, 400) }],
    };
  }
}

function moverEvidencias(diagrama) {
  const html = join(CARPETA, diagrama.html);
  const nombre = basename(html, '.html');
  const destino = join(VERIFICACION, dirname(diagrama.html));
  mkdirSync(destino, { recursive: true });
  for (const archivo of readdirSync(dirname(html))) {
    if (!archivo.startsWith(`${nombre}.visual-check.`)) continue;
    const final = join(destino, archivo);
    rmSync(final, { force: true });
    renameSync(join(dirname(html), archivo), final);
  }
}

function sellar(diagrama, huellas) {
  const { spec, archivos } = huellaDe(diagrama);
  huellas[diagrama.id] = { spec, archivos, sellado: new Date().toISOString() };
}

function evidenciaDe(diagrama) {
  if (!diagrama.evidencia) return [];
  const raiz = raices()[diagrama.evidencia];
  const revision = spawnSync('git', ['-C', raiz, 'rev-parse', 'origin/main'], { encoding: 'utf8' }).stdout.trim();
  const ruta = join(CARPETA, diagrama.spec);
  const spec = leerJson(ruta, null);
  if (revision && spec?.meta?.repository && spec.meta.repository.revision !== revision) {
    spec.meta.repository.revision = revision;
    escribirJson(ruta, spec);
  }
  return ['--repo-root', raiz];
}

function generar(diagrama, conNavegador) {
  const spec = join(CARPETA, diagrama.spec);
  const html = join(CARPETA, diagrama.html);
  const evidencia = evidenciaDe(diagrama);
  const validacion = archify(['validate', diagrama.tipo, spec, '--quality', 'showcase', ...evidencia]);
  if (!validacion.ok) return { ok: false, paso: 'validar', diagnosticos: validacion.diagnostics ?? [] };
  const entrega = archify(['deliver', diagrama.tipo, spec, html, '--quality', 'showcase', ...evidencia]);
  if (!entrega.ok) return { ok: false, paso: 'entregar', diagnosticos: entrega.diagnostics ?? [] };
  if (!conNavegador) return { ok: true, checks: validacion.checks?.length ?? 0 };
  const visual = archify(['visual-check', html]);
  moverEvidencias(diagrama);
  if (!visual.ok) return { ok: false, paso: 'navegador', diagnosticos: visual.diagnostics ?? [] };
  return { ok: true, checks: validacion.checks?.length ?? 0 };
}

function elegir(ids) {
  const todos = manifiesto().diagramas;
  if (!ids.length) return todos;
  const desconocidos = ids.filter((id) => !todos.some((diagrama) => diagrama.id === id));
  if (desconocidos.length) {
    console.error(`No existen en el manifiesto: ${desconocidos.join(', ')}`);
    process.exit(2);
  }
  return todos.filter((diagrama) => ids.includes(diagrama.id));
}

function comandoGenerar(ids, opciones) {
  if (!existsSync(join(ARCHIFY, 'bin', 'archify.mjs'))) {
    console.error(`No encuentro archify en ${ARCHIFY}. Instálalo con: npx skills add tt-a1i/archify -g`);
    process.exit(2);
  }
  const pendientes = new Set(
    estado()
      .filter((fila) => fila.situacion !== 'al-dia')
      .map((fila) => fila.diagrama.id),
  );
  const elegidos = opciones.pendientes ? elegir(ids).filter((diagrama) => pendientes.has(diagrama.id)) : elegir(ids);
  const huellas = leerJson(HUELLAS, {});
  let fallos = 0;
  for (const diagrama of elegidos) {
    const resultado = generar(diagrama, !opciones.sinNavegador);
    if (resultado.ok) {
      sellar(diagrama, huellas);
      console.log(`ok  ${diagrama.id} (${resultado.checks} checks)`);
      continue;
    }
    fallos += 1;
    console.log(`!!  ${diagrama.id} falló al ${resultado.paso}`);
    for (const diagnostico of resultado.diagnosticos.slice(0, 4)) {
      console.log(`      ${diagnostico.code}: ${diagnostico.message}`);
      if (diagnostico.evidence) console.log(`      ${JSON.stringify(diagnostico.evidence).slice(0, 300)}`);
    }
  }
  escribirJson(HUELLAS, huellas);
  if (!elegidos.length) console.log('Nada que generar.');
  comandoPortal(true);
  process.exit(fallos ? 1 : 0);
}

function comandoSellar(ids) {
  const huellas = leerJson(HUELLAS, {});
  for (const diagrama of elegir(ids)) {
    sellar(diagrama, huellas);
    console.log(`sellado ${diagrama.id}`);
  }
  escribirJson(HUELLAS, huellas);
  comandoPortal(true);
}

function comandoHook() {
  let entrada = {};
  try {
    entrada = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }
  const comando = entrada?.tool_input?.command ?? '';
  if (!MUTACIONES_GIT.test(comando)) process.exit(0);
  const pendientes = estado().filter((fila) => fila.situacion === 'codigo-cambio' || fila.situacion === 'sin-generar');
  const atlas = avisosAtlas();
  if (!pendientes.length && !atlas.length) process.exit(0);
  const lineas = pendientes.map((fila) => {
    const archivos = fila.cambiados.slice(0, 5).join(', ');
    return `- ${fila.diagrama.id} (${fila.diagrama.spec}): ${ETIQUETAS[fila.situacion]}${archivos ? ` → ${archivos}` : ''}`;
  });
  const contexto = [
    ...(pendientes.length ? [`Diagramas desactualizados (${pendientes.length}):`] : []),
    ...lineas,
    ...(pendientes.length ? ['Cambió lo que cuenta → generar; si no → sellar (skill diagramas).'] : []),
    ...(atlas.length ? [`Atlas: ${atlas.join('; ')} → \`pnpm diagramas atlas\`.`] : []),
  ].join('\n');
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: contexto } }),
  );
}

function commitDe(raiz) {
  return spawnSync('git', ['-C', raiz, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || null;
}

const ARCHIVOS_DE_CONTRATO = [
  /^src\/app\/core\/api\/.+\.ts$/,
  /Endpoints?\/.+\.cs$/,
  /Endpoints\.cs$/,
  /^src\/Finanzas\.Contracts\/.+\.cs$/,
];

function contratosCambiados(raiz, desde) {
  const salida = spawnSync('git', ['-C', raiz, 'diff', '--name-only', `${desde}..HEAD`], { encoding: 'utf8' });
  if (salida.status !== 0) return [];
  return salida.stdout
    .split('\n')
    .map((linea) => linea.trim())
    .filter((archivo) => archivo && ARCHIVOS_DE_CONTRATO.some((patron) => patron.test(archivo)));
}

function avisosAtlas() {
  const grafo = leerJson(GRAFO, null);
  if (!grafo) return ['el atlas no tiene grafo: corre `pnpm diagramas atlas`'];
  const avisos = [];
  const bases = { web: raices().front, api: raices().api };
  for (const [clave, nombre] of Object.entries(REPOS_GITNEXUS)) {
    const indexado = registro().find((repo) => repo.name === nombre)?.lastCommit;
    const actual = existsSync(bases[clave]) ? commitDe(bases[clave]) : null;
    if (!actual || !indexado || actual === indexado) continue;
    const cambiados = contratosCambiados(bases[clave], indexado);
    if (cambiados.length)
      avisos.push(`contratos de ${nombre} cambiaron (${cambiados.slice(0, 3).join(', ')}${cambiados.length > 3 ? '…' : ''})`);
  }
  return avisos;
}

function comandoPortal(silencioso = false) {
  const grafo = leerJson(GRAFO, null);
  const contratos = leerJson(CONTRATOS, null);
  if (!grafo || !contratos) {
    if (!silencioso) console.log('Faltan los datos del atlas: corre `pnpm diagramas atlas`.');
    return;
  }
  construirPortal({
    destino: PORTAL,
    carpeta: CARPETA,
    filas: estado(),
    huellas: leerJson(HUELLAS, {}),
    archivosDe,
    grafo,
    contratos,
    raices: raices(),
  });
  if (!silencioso) console.log(`Portal: ${relative(process.cwd(), PORTAL) || PORTAL}`);
}

const PREFIJO_DE_AREA = 'gitnexus-area-';
const RUIDO_DE_AREA = /\bsrc\/app\/ui\/helm\//;

function podarSkillsDeArea(raiz) {
  const carpeta = join(raiz, '.claude', 'skills');
  if (!existsSync(carpeta)) return;
  for (const nombre of readdirSync(carpeta)) {
    if (!nombre.startsWith(PREFIJO_DE_AREA)) continue;
    const ruta = join(carpeta, nombre);
    const area = nombre.slice(PREFIJO_DE_AREA.length);
    if (/^cluster-\d+$/.test(area) || area.endsWith('-tests')) {
      rmSync(ruta, { recursive: true, force: true });
      continue;
    }
    const archivo = join(ruta, 'SKILL.md');
    if (!existsSync(archivo)) continue;
    const lineas = readFileSync(archivo, 'utf8')
      .split('\n')
      .filter((linea) => !RUIDO_DE_AREA.test(linea));
    const archivos = lineas
      .filter((linea) => linea.startsWith('| `'))
      .map((linea) => linea.split('`')[1])
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    const texto = lineas
      .join('\n')
      .replace(
        /^description: .*$/m,
        `description: "Mapa del área ${area}: archivos clave, puntos de entrada y flujos. Cargar solo al modificar código del área ${area} (${archivos})."`,
      );
    writeFileSync(archivo, texto);
  }
}

function reindexar(opciones = {}) {
  const pdg = opciones.pdg ? ['--pdg'] : [];
  const pasos = [
    { raiz: raices().front, args: ['analyze', '--skills', '--skip-agents-md', '--skip-skills', '--no-stats', ...pdg] },
    { raiz: raices().api, args: ['analyze', '--skills', '--skip-agents-md', '--skip-skills', ...pdg] },
  ];
  for (const { raiz, args } of pasos) {
    if (!existsSync(raiz)) continue;
    console.log(`GitNexus analiza ${basename(raiz)}…`);
    const resultado = gitnexus(args, { cwd: raiz, stdio: ['ignore', 'ignore', 'pipe'] });
    if (resultado.status !== 0) throw new Error(`gitnexus analyze falló en ${raiz}: ${resultado.stderr?.slice(-400)}`);
  }
  gitnexus(['group', 'sync', GRUPO_GITNEXUS], { stdio: 'ignore' });
  for (const { raiz } of pasos) if (existsSync(raiz)) podarSkillsDeArea(raiz);
}

function comandoPodar() {
  for (const raiz of [raices().front, raices().api]) if (existsSync(raiz)) podarSkillsDeArea(raiz);
  console.log('Skills de área podadas.');
}

function comandoAtlas(opciones) {
  if (!opciones.sinReindexar) reindexar(opciones);
  mkdirSync(DATOS, { recursive: true });
  console.log('Exportando el grafo por módulos…');
  escribirJson(GRAFO, exportarGrafo(REPOS_GITNEXUS));
  console.log('Cruzando contratos web ↔ API…');
  const contratos = exportarContratos(raices());
  escribirJson(CONTRATOS, contratos);
  const { conectados, sinUsoEnWeb, sinPantalla, sinEndpoint, metodoDesconocido } = contratos.resumen;
  console.log(
    `Contratos: ${conectados} conectados, ${sinUsoEnWeb} sin uso en la web, ${sinPantalla} sin pantalla, ${sinEndpoint} sin endpoint, ${metodoDesconocido} con método dudoso.`,
  );
  comandoPortal();
}

function comandoExplorar() {
  const cli = cliGitnexus();
  if (!cli) throw new Error('No encuentro el CLI de gitnexus.');
  const servidor = spawn(process.execPath, [cli, 'serve'], { detached: true, stdio: 'ignore' });
  servidor.unref();
  const url = 'https://gitnexus.vercel.app';
  console.log(
    `gitnexus serve corre en segundo plano (pid ${servidor.pid}); la interfaz se conecta sola a http://localhost:4747.`,
  );
  console.log(`Abriendo ${url}`);
  const [programa, argumentos] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(programa, argumentos, { detached: true, stdio: 'ignore' }).unref();
}

function ayuda() {
  console.log(`Uso: node scripts/diagramas.mjs <comando> [ids…]

  estado [--detalle] [--estricto]   qué diagramas quedaron viejos respecto al código
  generar [ids…] [--pendientes] [--sin-navegador]
                                    valida, entrega y revisa en navegador con archify; sella si pasa
  sellar [ids…]                     marca como revisados contra el código actual sin regenerar
  atlas [--sin-reindexar] [--pdg]   reindexa con GitNexus (PDG opcional), exporta grafo y contratos y regenera el portal
  podar                             limpia las skills gitnexus-area-* (sin clusters anónimos ni ruido de ui/helm)
  portal                            regenera docs/diagramas/index.html con los datos actuales
  explorar                          levanta gitnexus serve y abre la interfaz web con el grafo completo
  lista                             diagramas del manifiesto por área
  hook                              uso interno del hook de Claude Code tras mutaciones de git`);
}

const [comando = 'estado', ...resto] = process.argv.slice(2);
const banderas = new Set(resto.filter((arg) => arg.startsWith('--')));
const ids = resto.filter((arg) => !arg.startsWith('--'));

if (comando === 'estado') {
  const pendientes = imprimirEstado(estado(), banderas.has('--detalle'));
  for (const aviso of avisosAtlas()) console.log(`atlas: ${aviso}`);
  if (banderas.has('--estricto') && pendientes.length) process.exit(1);
} else if (comando === 'generar') {
  comandoGenerar(ids, { pendientes: banderas.has('--pendientes'), sinNavegador: banderas.has('--sin-navegador') });
} else if (comando === 'sellar') {
  comandoSellar(ids);
} else if (comando === 'lista') {
  for (const diagrama of manifiesto().diagramas)
    console.log(`${diagrama.area.padEnd(16)} ${diagrama.id.padEnd(34)} ${diagrama.tipo}`);
} else if (comando === 'atlas') {
  comandoAtlas({ sinReindexar: banderas.has('--sin-reindexar'), pdg: banderas.has('--pdg') });
} else if (comando === 'podar') {
  comandoPodar();
} else if (comando === 'portal') {
  comandoPortal();
} else if (comando === 'explorar') {
  comandoExplorar();
} else if (comando === 'hook') {
  comandoHook();
} else {
  ayuda();
  process.exit(comando === 'ayuda' ? 0 : 2);
}
