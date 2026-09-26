import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLANTILLA = join(dirname(fileURLToPath(import.meta.url)), 'portal.html');

const AREAS = {
  '00-mapa': 'Mapa',
  '01-frontend': 'Frontend',
  '02-api': 'API',
  '03-sesion': 'Sesión',
  '04-movimientos': 'Movimientos',
  '05-planificacion': 'Planificación',
  '06-personas': 'Personas',
  '07-administracion': 'Administración',
  '08-soporte': 'Soporte',
  '09-entrega': 'Entrega',
};

export function urlDeRepo(raiz) {
  const remoto = spawnSync('git', ['-C', raiz, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).stdout?.trim();
  if (!remoto) return null;
  return remoto.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
}

export function construirPortal({ destino, carpeta, filas, huellas, archivosDe, grafo, contratos, raices }) {
  const diagramas = filas.map(({ diagrama, situacion }) => {
    const spec = JSON.parse(readFileSync(join(carpeta, diagrama.spec), 'utf8'));
    const archivos = Object.keys(archivosDe(diagrama.fuentes).archivos).map((clave) => {
      const [repo, ...resto] = clave.split(':');
      return { repo, ruta: resto.join(':') };
    });
    return {
      id: diagrama.id,
      area: diagrama.area,
      tipo: diagrama.tipo,
      titulo: spec.meta?.title ?? diagrama.id,
      cuenta: diagrama.cuenta,
      html: diagrama.html,
      vistas: (spec.meta?.views ?? []).map((vista) => vista.label),
      situacion,
      sellado: huellas[diagrama.id]?.sellado ?? null,
      fuentes: archivos,
    };
  });
  const areas = [...new Set(diagramas.map((d) => d.area))].map((id) => ({ id, nombre: AREAS[id] ?? id }));
  const atlas = {
    generado: new Date().toISOString(),
    repos: {
      front: { nombre: 'gestor-Finanzas', url: urlDeRepo(raices.front) },
      api: { nombre: 'v2-api-finanzas', url: urlDeRepo(raices.api) },
    },
    areas,
    diagramas,
    grafo,
    contratos,
  };
  const json = JSON.stringify(atlas).replace(/</g, '\\u003c');
  writeFileSync(
    destino,
    readFileSync(PLANTILLA, 'utf8').replace('__ATLAS__', () => json),
    'utf8',
  );
  return atlas;
}
