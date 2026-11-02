import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const PLANTILLA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'portal.html'), 'utf8');
const ATAQUE = '<img src=x onerror=alert(1)>';
const ATAQUE_COMILLA = '"><img src=x onerror=alert(2)>';

function atlasMalicioso(html = 'a/b.html') {
  const modulo = (repo) => ({
    id: `${repo}:${ATAQUE}`,
    repo,
    nombre: ATAQUE,
    simbolos: ATAQUE,
    clusters: ATAQUE,
    archivos: [{ ruta: ATAQUE, simbolos: ATAQUE }],
    procesos: [{ label: ATAQUE, pasos: ATAQUE, tipo: ATAQUE_COMILLA, modulos: [] }],
    procesosTotales: ATAQUE,
  });
  const repoGrafo = (clave) => ({
    clave,
    nombre: ATAQUE,
    commit: ATAQUE,
    indexado: ATAQUE,
    stats: { nodes: ATAQUE, edges: ATAQUE, communities: ATAQUE },
    procesosTotales: ATAQUE,
    modulos: [modulo(clave)],
    enlaces: [],
  });
  return {
    generado: ATAQUE,
    repos: { front: { nombre: ATAQUE, url: 'https://example.test/x' }, api: { nombre: ATAQUE, url: null } },
    areas: [{ id: 'area', nombre: ATAQUE }],
    diagramas: [
      {
        id: ATAQUE_COMILLA,
        area: 'area',
        tipo: ATAQUE,
        titulo: ATAQUE,
        cuenta: ATAQUE_COMILLA,
        html,
        vistas: [ATAQUE],
        situacion: ATAQUE,
        sellado: ATAQUE,
        fuentes: [{ repo: 'front', ruta: ATAQUE }],
      },
    ],
    grafo: { generado: ATAQUE, repos: { front: repoGrafo('web'), api: repoGrafo('api') } },
    contratos: {
      generado: ATAQUE,
      resumen: {
        conectados: ATAQUE,
        sinUsoEnWeb: ATAQUE,
        sinPantalla: ATAQUE,
        sinEndpoint: ATAQUE,
        metodoDesconocido: ATAQUE,
      },
      contratos: [
        {
          metodo: ATAQUE,
          ruta: ATAQUE,
          permiso: ATAQUE,
          estado: ATAQUE,
          api: { archivo: ATAQUE, linea: ATAQUE },
          web: [{ archivo: ATAQUE, linea: ATAQUE, funcion: ATAQUE }],
        },
      ],
    },
  };
}

function abrir({ atlas = atlasMalicioso(), hash = '' } = {}) {
  const json = JSON.stringify(atlas).replace(/</g, '\\u003c');
  const consola = new VirtualConsole();
  const errores = [];
  consola.on('jsdomError', (e) => errores.push(e));
  const dom = new JSDOM(
    PLANTILLA.replace('__ATLAS__', () => json),
    {
      url: `file:///portal/index.html${hash}`,
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: consola,
      beforeParse(ventana) {
        ventana.HTMLCanvasElement.prototype.getContext = () =>
          new Proxy(() => undefined, { get: () => () => undefined, set: () => true });
        ventana.ResizeObserver = class {
          observe() {}
          disconnect() {}
        };
        ventana.matchMedia = () => ({ matches: false, addEventListener() {} });
      },
    },
  );
  return { ventana: dom.window, documento: dom.window.document, errores };
}

function navegar(ventana, ruta) {
  ventana.location.hash = ruta;
  ventana.dispatchEvent(new ventana.HashChangeEvent('hashchange'));
}

function sinElementosInyectados(documento) {
  assert.equal(documento.querySelectorAll('img[src="x"]').length, 0, 'se creo un <img> inyectado');
  const conManejador = [...documento.querySelectorAll('*')].filter((el) =>
    el.getAttributeNames().some((nombre) => nombre.startsWith('on')),
  );
  assert.deepEqual(
    conManejador.map((el) => el.outerHTML.slice(0, 80)),
    [],
  );
}

const vistas = ['diagramas', 'grafo', 'contratos', 'salud'];

for (const vista of vistas) {
  test(`vista ${vista}: datos maliciosos del ATLAS no crean elementos ni atributos on*`, () => {
    const { ventana, documento, errores } = abrir({ hash: `#/${vista}` });
    sinElementosInyectados(documento);
    assert.deepEqual(errores, []);
    ventana.close();
  });
}

test('el texto malicioso aparece escapado como texto', () => {
  const { ventana, documento } = abrir({ hash: '#/salud' });
  assert.ok(documento.querySelector('#vista-salud').textContent.includes(ATAQUE));
  navegar(ventana, '#/contratos');
  assert.ok(documento.querySelector('#vista-contratos').textContent.includes(ATAQUE));
  navegar(ventana, '#/diagramas');
  assert.ok(documento.querySelector('#visor-cab h1').textContent.includes(ATAQUE));
  ventana.close();
});

test('el hash malicioso no inyecta HTML', () => {
  const { ventana, documento } = abrir();
  for (const vista of ['diagramas', 'grafo', 'contratos']) {
    navegar(ventana, `#/${vista}/${encodeURIComponent(ATAQUE)}`);
    sinElementosInyectados(documento);
    navegar(ventana, `#/${vista}/${ATAQUE_COMILLA}`);
    sinElementosInyectados(documento);
  }
  navegar(ventana, `#/contratos/${encodeURIComponent(`modulo:${ATAQUE}`)}`);
  sinElementosInyectados(documento);
  assert.ok(documento.querySelector('#vista-contratos').textContent.includes(ATAQUE));
  navegar(ventana, '#/contratos/%E0%A4%A');
  sinElementosInyectados(documento);
  ventana.close();
});

test('el filtro del buscador no inyecta HTML', () => {
  const { ventana, documento } = abrir({ hash: '#/contratos' });
  const buscador = documento.querySelector('#buscar');
  for (const vista of ['contratos', 'diagramas', 'grafo']) {
    navegar(ventana, `#/${vista}`);
    buscador.value = ATAQUE;
    buscador.dispatchEvent(new ventana.Event('input', { bubbles: true }));
    sinElementosInyectados(documento);
  }
  ventana.close();
});

test('el iframe solo recibe rutas relativas del propio atlas', () => {
  const malas = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.test/x.html',
    'https://evil.test/x.html',
    '../fuera.html',
    'a/../b.html',
    '/absoluta.html',
    'a/b.html?x=1',
    'a/b.txt',
    '',
  ];
  for (const ruta of malas) {
    const { ventana, documento } = abrir({ atlas: atlasMalicioso(ruta), hash: '#/diagramas' });
    assert.equal(documento.querySelector('#marco').getAttribute('src'), null, `se asigno src para ${ruta}`);
    assert.equal(documento.querySelector('#visor-cab a.boton'), null, `enlace para ${ruta}`);
    ventana.close();
  }
  const { ventana, documento } = abrir({ atlas: atlasMalicioso('03-sesion/login.html'), hash: '#/diagramas' });
  assert.equal(documento.querySelector('#marco').getAttribute('src'), '03-sesion/login.html');
  assert.equal(documento.querySelector('#visor-cab a.boton').getAttribute('href'), '03-sesion/login.html');
  ventana.close();
});
