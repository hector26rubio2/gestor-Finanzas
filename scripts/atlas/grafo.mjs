import { cypher, registro } from './gitnexus.mjs';

const CODIGO = { web: /^(src|scripts)\/.+\.(ts|mjs|html|css)$/, api: /^src\/.+\.cs$/ };
const ES_PRUEBA = /(^|\/)(tests?|e2e|Migrations)\/|\.spec\.ts$|Tests?\.cs$/;

const MODULO = {
  web(ruta) {
    const partes = ruta.split('/');
    if (partes[0] !== 'src' || partes[1] !== 'app') return partes[0] === 'src' ? 'arranque' : partes[0];
    const [, , grupo, nombre, sub] = partes;
    if (partes.length === 3) return 'app';
    if (grupo === 'ui') return nombre === 'helm' ? 'ui/helm' : 'ui';
    if (grupo === 'pages' && nombre === 'admin' && sub === 'tabs') return 'pages/admin/tabs';
    return partes.length === 4 ? grupo : `${grupo}/${nombre}`;
  },
  api(ruta) {
    const partes = ruta.split('/');
    if (partes[0] !== 'src') return partes[0];
    const proyecto = partes[1].replace('Finanzas.', '');
    if (partes.length === 3) return proyecto;
    if (proyecto === 'Infrastructure' && partes[2] === 'Persistence' && partes[3] === 'Queries')
      return 'Infrastructure/Queries';
    if (proyecto === 'Infrastructure' && partes[2] === 'Persistence' && partes[3] === 'Migrations')
      return 'Infrastructure/Migrations';
    return `${proyecto}/${partes[2]}`;
  },
};

function agregar(mapa, clave, crear) {
  if (!mapa.has(clave)) mapa.set(clave, crear());
  return mapa.get(clave);
}

function exportarRepo(clave, nombre) {
  const moduloDe = (ruta) =>
    ruta && !ES_PRUEBA.test(ruta) && CODIGO[clave].test(ruta) ? `${clave}:${MODULO[clave](ruta)}` : null;
  const modulos = new Map();
  const modulo = (id) =>
    agregar(modulos, id, () => ({
      id,
      repo: clave,
      nombre: id.split(':')[1],
      archivos: new Map(),
      clusters: new Set(),
      procesos: new Map(),
    }));

  for (const fila of cypher(
    nombre,
    "MATCH (f:File)-[:CodeRelation {type: 'DEFINES'}]->(s) RETURN f.filePath AS f, count(s) AS n",
  )) {
    const id = moduloDe(fila.f);
    if (id) modulo(id).archivos.set(fila.f, fila.n);
  }
  for (const fila of cypher(nombre, 'MATCH (f:File) RETURN f.filePath AS f')) {
    const id = moduloDe(fila.f);
    if (id && !modulo(id).archivos.has(fila.f)) modulo(id).archivos.set(fila.f, 0);
  }
  for (const fila of cypher(
    nombre,
    "MATCH (s)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community) RETURN DISTINCT c.id AS c, s.filePath AS f",
  )) {
    const id = moduloDe(fila.f);
    if (id) modulo(id).clusters.add(fila.c);
  }

  const procesos = new Map(
    cypher(
      nombre,
      'MATCH (p:Process) RETURN p.id AS id, p.heuristicLabel AS label, p.stepCount AS pasos, p.processType AS tipo',
    ).map((fila) => [fila.id, fila]),
  );
  const modulosPorProceso = new Map();
  for (const fila of cypher(
    nombre,
    "MATCH (s)-[:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process) RETURN DISTINCT p.id AS p, s.filePath AS f",
  )) {
    const id = moduloDe(fila.f);
    if (!id || !procesos.has(fila.p)) continue;
    agregar(modulosPorProceso, fila.p, () => new Set()).add(id);
    modulo(id).procesos.set(fila.p, procesos.get(fila.p));
  }

  const enlaces = new Map();
  for (const fila of cypher(
    nombre,
    "MATCH (a)-[:CodeRelation {type: 'CALLS'}]->(b) WHERE a.filePath <> b.filePath RETURN a.filePath AS de, b.filePath AS a, count(*) AS n",
  )) {
    const de = moduloDe(fila.de);
    const a = moduloDe(fila.a);
    if (!de || !a || de === a) continue;
    const enlace = agregar(enlaces, `${de}>${a}`, () => ({ de, a, llamadas: 0 }));
    enlace.llamadas += fila.n;
  }

  const entrada = registro().find((repo) => repo.name === nombre);
  return {
    clave,
    nombre,
    commit: entrada?.lastCommit ?? null,
    indexado: entrada?.indexedAt ?? null,
    stats: entrada?.stats ?? null,
    procesosTotales: procesos.size,
    modulos: [...modulos.values()]
      .filter((m) => m.archivos.size)
      .map((m) => ({
        id: m.id,
        repo: m.repo,
        nombre: m.nombre,
        simbolos: [...m.archivos.values()].reduce((total, n) => total + n, 0),
        clusters: m.clusters.size,
        archivos: [...m.archivos.entries()].sort((x, y) => y[1] - x[1]).map(([ruta, simbolos]) => ({ ruta, simbolos })),
        procesos: [...m.procesos.values()]
          .sort((x, y) => y.pasos - x.pasos)
          .slice(0, 12)
          .map((p) => ({
            label: p.label,
            pasos: p.pasos,
            tipo: p.tipo,
            modulos: [...(modulosPorProceso.get(p.id) ?? [])],
          })),
        procesosTotales: m.procesos.size,
      }))
      .sort((x, y) => y.simbolos - x.simbolos),
    enlaces: [...enlaces.values()].sort((x, y) => y.llamadas - x.llamadas),
  };
}

export function exportarGrafo(repos) {
  return {
    generado: new Date().toISOString(),
    repos: Object.fromEntries(Object.entries(repos).map(([clave, nombre]) => [clave, exportarRepo(clave, nombre)])),
  };
}
