import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const METODOS_API = /\b(\w+)\.Map(Get|Post|Put|Delete|Patch)\(\s*"([^"]*)"/g;
const GRUPO_API = /\bvar\s+(\w+)\s*=\s*\w+\.MapGroup\(\s*"([^"]+)"/g;
const PERMISO_API = /Require(?:Any)?Permission\(([^)]*)\)/;
const ENTRADA_RUTA = /^\s*(\w+):\s*(?:\([^)]*\)\s*=>\s*)?(['`])(\/api\/[^'`]*)\2/gm;
const USO_RUTA = /API_ROUTES\.(\w+)(?:\([^)]*\))?(?:\}([\w\-/]+))?/g;
const METODO_WEB = /method:\s*'(\w+)'/g;
const METODO_TERNARIO = /method:\s*[\w.]+\s*\?\s*'(\w+)'\s*:\s*'(\w+)'/;
const CLIENTE_HTTP = /\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\(\s*[^()]*$/i;
const CONSTANTE_DE_RUTA = /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*['`]\/api\//;
const LITERAL_API = /['`](?:\$\{[^}]+\})?(\/api\/v1\/[\w\-/.]*(?:\$\{[^}]+\}[\w\-/.]*)*)(?:\?[^'`]*)?['`]/g;
const FUNCION_TS =
  /^\s*(?:(?:public|private|protected|async|static|readonly)\s+)*(\w+)\s*(?:<[^>]*>)?\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$/;

function normalizar(ruta) {
  return (
    ruta
      .replace(/\$\{[^}]+\}/g, '{}')
      .replace(/\{[^}]+\}/g, '{}')
      .replace(/\/+$/, '')
      .toLowerCase() || '/'
  );
}

function lineaDe(texto, indice) {
  return texto.slice(0, indice).split('\n').length;
}

function permisoDe(tramo) {
  const requerido = tramo.match(PERMISO_API)?.[1];
  if (requerido)
    return requerido
      .replace(/PermissionCodes\./g, '')
      .replace(/["\s]/g, '')
      .split(',')
      .join(' | ');
  return /AllowAnonymous\(\)/.test(tramo) ? 'anónimo' : null;
}

function prefijoDe(variable, grupos, archivo) {
  if (grupos.has(variable)) return grupos.get(variable);
  if (variable === 'api' && archivo.includes('/Endpoints/')) return '/api/v1';
  return '';
}

export function rutasApi(raiz) {
  const rutas = [];
  const prefijosPorArchivo = new Map();
  const archivos = globSync('src/Finanzas.Host/**/*.cs', { cwd: raiz }).map((ruta) => ruta.replace(/\\/g, '/'));
  for (const archivo of archivos) {
    const texto = readFileSync(join(raiz, archivo), 'utf8');
    const grupos = new Map([...texto.matchAll(GRUPO_API)].map((g) => [g[1], g[2]]));
    prefijosPorArchivo.set(archivo, grupos);
    const llamadas = [...texto.matchAll(METODOS_API)];
    llamadas.forEach((llamada, i) => {
      const [, variable, metodo, ruta] = llamada;
      const prefijo = prefijoDe(variable, grupos, archivo);
      const completa = `${prefijo}${ruta}`;
      if (!completa.startsWith('/api/')) return;
      const tramo = texto.slice(llamada.index, llamadas[i + 1]?.index ?? texto.length);
      rutas.push({
        metodo: metodo.toUpperCase(),
        ruta: completa,
        clave: `${metodo.toUpperCase()} ${normalizar(completa)}`,
        archivo,
        linea: lineaDe(texto, llamada.index),
        permiso: permisoDe(tramo),
      });
    });
  }
  return rutas;
}

const METODO_DE_CLASE = /^ {2}(?:(?:public|private|protected|async|static)\s+)*(\w+)\s*(?:<[^>]*>)?\(/;

function funcionQueContiene(lineas, indiceLinea) {
  for (let i = indiceLinea; i >= 0; i -= 1) {
    const encontrada = lineas[i].match(METODO_DE_CLASE) ?? lineas[i].match(FUNCION_TS);
    if (encontrada && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(encontrada[1]))
      return encontrada[1];
  }
  return null;
}

function metodoCercano(texto, indice, funcion) {
  if (funcion && /Url$/.test(funcion)) return 'GET';
  const antes = texto.slice(Math.max(0, indice - 220), indice);
  const cliente = antes.match(CLIENTE_HTTP);
  if (cliente) return cliente[1].toUpperCase();
  const ternario = antes.match(METODO_TERNARIO);
  if (ternario && /\?\s*$/.test(antes)) return ternario[1].toUpperCase();
  if (ternario && /[^h]:\s*$/.test(antes) && !/path:\s*$/.test(antes)) return ternario[2].toUpperCase();
  const metodos = [...texto.slice(Math.max(0, indice - 220), indice + 60).matchAll(METODO_WEB)];
  if (metodos.length) return metodos[metodos.length - 1][1].toUpperCase();
  return null;
}

export function llamadasWeb(raiz) {
  const catalogo = readFileSync(join(raiz, 'src/app/core/api/api-routes.ts'), 'utf8');
  const rutasPorClave = new Map([...catalogo.matchAll(ENTRADA_RUTA)].map((e) => [e[1], e[3]]));
  const llamadas = [];
  const archivos = globSync('src/app/**/*.ts', { cwd: raiz })
    .map((ruta) => ruta.replace(/\\/g, '/'))
    .filter((ruta) => !ruta.endsWith('.spec.ts') && !ruta.endsWith('api-routes.ts'));
  for (const archivo of archivos) {
    const texto = readFileSync(join(raiz, archivo), 'utf8');
    const lineas = texto.split('\n');
    for (const uso of texto.matchAll(USO_RUTA)) {
      const base = rutasPorClave.get(uso[1]);
      if (!base) continue;
      const ruta = `${base}${uso[2] ?? ''}`;
      const linea = lineaDe(texto, uso.index);
      const funcion = funcionQueContiene(lineas, linea - 1);
      llamadas.push({
        metodo: metodoCercano(texto, uso.index, funcion),
        ruta,
        archivo,
        linea,
        funcion,
        via: `API_ROUTES.${uso[1]}`,
      });
    }
    for (const literal of texto.matchAll(LITERAL_API)) {
      const linea = lineaDe(texto, literal.index);
      const contexto = lineas[linea - 1] ?? '';
      const constante = contexto.match(CONSTANTE_DE_RUTA)?.[1];
      if (constante) {
        for (const uso of texto.matchAll(new RegExp(String.raw`\b${constante}\b(?!\s*=)`, 'g'))) {
          const lineaDeUso = lineaDe(texto, uso.index);
          if (lineaDeUso === linea) continue;
          const funcion = funcionQueContiene(lineas, lineaDeUso - 1);
          const metodo = metodoCercano(texto, uso.index, funcion);
          if (!metodo) continue;
          llamadas.push({ metodo, ruta: literal[1], archivo, linea: lineaDeUso, funcion, via: constante });
        }
        continue;
      }
      llamadas.push({
        metodo: /EventSource/.test(contexto)
          ? 'GET'
          : metodoCercano(texto, literal.index, funcionQueContiene(lineas, linea - 1)),
        ruta: literal[1],
        archivo,
        linea,
        funcion: funcionQueContiene(lineas, linea - 1),
        via: /EventSource/.test(contexto) ? 'EventSource' : 'literal',
      });
    }
  }
  return llamadas.map((llamada) => ({
    ...llamada,
    clave: llamada.metodo ? `${llamada.metodo} ${normalizar(llamada.ruta)}` : null,
  }));
}

function usosEnPantalla(raiz) {
  const fuentes = globSync('src/app/**/*.{ts,html}', { cwd: raiz })
    .map((ruta) => ruta.replace(/\\/g, '/'))
    .filter((ruta) => !ruta.endsWith('.spec.ts') && !ruta.startsWith('src/app/core/api/'))
    .map((ruta) => readFileSync(join(raiz, ruta), 'utf8'))
    .join('\n');
  return (funcion) => new RegExp(`\\.${funcion}\\(`).test(fuentes);
}

function llegaAPantalla(consumidor, usado) {
  if (!consumidor.archivo.startsWith('src/app/core/api/')) return true;
  return Boolean(consumidor.funcion && usado(consumidor.funcion));
}

export function exportarContratos(raices) {
  const api = rutasApi(raices.api);
  const web = llamadasWeb(raices.front);
  const usado = usosEnPantalla(raices.front);
  const porClave = new Map(api.map((ruta) => [ruta.clave, { ...ruta, consumidores: [] }]));
  const huerfanas = [];
  for (const llamada of web) {
    const endpoint = llamada.clave && porClave.get(llamada.clave);
    if (endpoint) endpoint.consumidores.push(llamada);
    else huerfanas.push(llamada);
  }
  const contratos = [...porClave.values()].map((endpoint) => ({
    metodo: endpoint.metodo,
    ruta: endpoint.ruta,
    permiso: endpoint.permiso,
    api: { archivo: endpoint.archivo, linea: endpoint.linea },
    web: endpoint.consumidores.map(({ archivo, linea, funcion, via }) => ({ archivo, linea, funcion, via })),
    estado: !endpoint.consumidores.length
      ? 'sin-uso-en-web'
      : endpoint.consumidores.some((consumidor) => llegaAPantalla(consumidor, usado))
        ? 'conectado'
        : 'sin-pantalla',
  }));
  const sinEndpoint = new Map();
  for (const llamada of huerfanas) {
    const clave = llamada.clave ?? `? ${normalizar(llamada.ruta)}`;
    const grupo = sinEndpoint.get(clave) ?? {
      metodo: llamada.metodo ?? '?',
      ruta: llamada.ruta,
      permiso: null,
      api: null,
      web: [],
      estado: llamada.metodo ? 'sin-endpoint' : 'metodo-desconocido',
    };
    grupo.web.push({ archivo: llamada.archivo, linea: llamada.linea, funcion: llamada.funcion, via: llamada.via });
    sinEndpoint.set(clave, grupo);
  }
  const todos = [...contratos, ...sinEndpoint.values()].sort(
    (a, b) => a.ruta.localeCompare(b.ruta) || a.metodo.localeCompare(b.metodo),
  );
  return {
    generado: new Date().toISOString(),
    resumen: {
      conectados: todos.filter((c) => c.estado === 'conectado').length,
      sinUsoEnWeb: todos.filter((c) => c.estado === 'sin-uso-en-web').length,
      sinPantalla: todos.filter((c) => c.estado === 'sin-pantalla').length,
      sinEndpoint: todos.filter((c) => c.estado === 'sin-endpoint').length,
      metodoDesconocido: todos.filter((c) => c.estado === 'metodo-desconocido').length,
    },
    contratos: todos,
  };
}
