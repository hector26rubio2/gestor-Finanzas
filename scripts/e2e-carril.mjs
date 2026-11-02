const PUERTO_WEB_BASE = 4300;
const PUERTO_API_BASE = 5199;
const API_SIN_CARRIL = 'http://localhost:5198';
const BASE_SIN_CARRIL = 'finanzas_e2e_ci';

function numeroDeCarril(valor) {
  if (valor === undefined || valor === '') return null;
  if (!/^[1-9]$/.test(valor)) throw new Error(`E2E_CARRIL debe ser un número del 1 al 9 (recibido: ${valor}).`);
  return Number(valor);
}

function puertoValido(valor, nombre) {
  const puerto = Number(valor);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)
    throw new Error(`${nombre} debe ser un puerto válido (recibido: ${valor}).`);
  return puerto;
}

function puertoDe(url) {
  const analizada = new URL(url);
  return Number(analizada.port || (analizada.protocol === 'https:' ? 443 : 80));
}

export function derivarCarril(env) {
  const carril = numeroDeCarril(env.E2E_CARRIL);
  const sufijo = carril === null ? '' : `-c${carril}`;
  const puertoWeb = env.E2E_WEB_PORT ? puertoValido(env.E2E_WEB_PORT, 'E2E_WEB_PORT') : PUERTO_WEB_BASE + (carril ?? 0);
  const webUrl = (env.E2E_BASE_URL ?? `http://localhost:${puertoWeb}`).replace(/\/$/, '');
  const apiUrl = (
    env.API_BASE_URL ?? (carril === null ? API_SIN_CARRIL : `http://localhost:${PUERTO_API_BASE + carril}`)
  ).replace(/\/$/, '');
  const dbName = env.E2E_DB_NAME ?? (carril === null ? BASE_SIN_CARRIL : `finanzas_e2e_c${carril}`);
  return {
    carril,
    aislado: carril !== null || Boolean(env.E2E_WEB_PORT),
    webUrl,
    webPort: puertoDe(webUrl),
    apiUrl,
    apiPort: puertoDe(apiUrl),
    dbName,
    resultados: `resultados${sufijo}`,
    informe: `informe${sufijo}`,
    estado: `.estado${sufijo}`,
  };
}
