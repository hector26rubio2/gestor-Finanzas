import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(webRoot, process.env.FINANZAS_API_DIR ?? '../v2-api-finanzas');
const apiUrl = (process.env.API_BASE_URL ?? 'http://localhost:5198').replace(/\/$/, '');
const dbName = process.env.E2E_DB_NAME ?? 'finanzas_e2e_ci';
const contenedor = process.env.E2E_DB_CONTAINER ?? 'finanzas-postgres';
const puertoPostgres = process.env.E2E_DB_PORT ?? '5433';
const esWindows = process.platform === 'win32';

let api;

function fallar(mensaje) {
  console.error(mensaje);
  stopApi();
  process.exit(1);
}

function ejecutar(comando, argumentos, opciones = {}) {
  const resultado = spawnSync(comando, argumentos, {
    encoding: 'utf8',
    windowsHide: true,
    ...opciones,
  });
  if (resultado.status !== 0)
    fallar(`Falló: ${comando} ${argumentos.join(' ')}\n${resultado.stdout ?? ''}${resultado.stderr ?? ''}`);
  return resultado;
}

function clave() {
  return randomBytes(18).toString('base64url');
}

async function responde(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function esperar(url, ms, descripcion) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (api && api.exitCode !== null) fallar(`${descripcion} terminó antes de estar listo.`);
    if (await responde(url)) return;
    await new Promise((listo) => setTimeout(listo, 500));
  }
  fallar(`${descripcion} no respondió en ${ms / 1000} segundos.`);
}

function contenedorCorriendo() {
  const estado = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', contenedor], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return estado.status === 0 && estado.stdout.trim() === 'true';
}

function prepararBase() {
  if (!/^finanzas_e2e[\w]*$/.test(dbName))
    fallar(`E2E_DB_NAME debe empezar por finanzas_e2e (recibido: ${dbName}); no se toca otra base.`);
  if (!contenedorCorriendo()) {
    ejecutar('docker', [
      'compose',
      '-p',
      'v2-api-finanzas',
      '-f',
      join(apiDir, 'docker-compose.local.yml'),
      'up',
      '-d',
      '--wait',
    ]);
  }
  const psql = (sql) => ejecutar('docker', ['exec', contenedor, 'psql', '-U', 'finanzas', '-d', 'postgres', '-c', sql]);
  psql(`drop database if exists ${dbName} with (force)`);
  psql(`create database ${dbName}`);
}

function stopApi() {
  if (!api?.pid || api.exitCode !== null) return;
  if (esWindows) spawnSync('taskkill', ['/pid', String(api.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  else api.kill('SIGTERM');
}

async function levantarApi(entorno) {
  if (await responde(`${apiUrl}/api/v1/auth/methods`))
    fallar(`Ya hay un API respondiendo en ${apiUrl}; ciérralo o cambia API_BASE_URL.`);
  const registro = join(webRoot, 'e2e', '.estado', 'api.log');
  mkdirSync(dirname(registro), { recursive: true });
  const descriptor = openSync(registro, 'w');
  api = spawn('dotnet', ['run', '--project', 'src/Finanzas.Host', '--no-launch-profile'], {
    cwd: apiDir,
    env: { ...process.env, ...entorno },
    stdio: ['ignore', descriptor, descriptor],
    windowsHide: true,
  });
  try {
    await esperar(`${apiUrl}/api/v1/auth/methods`, 180_000, 'El API');
  } catch (error) {
    console.error(readFileSync(registro, 'utf8').slice(-2000));
    throw error;
  }
}

async function principal() {
  if (!existsSync(join(apiDir, 'Finanzas.slnx')))
    fallar(`No hay un checkout del API en ${apiDir}. Define FINANZAS_API_DIR.`);
  const propietario = { usuario: 'e2e-propietario', clave: clave(), correo: 'e2e-propietario@finanzas.test' };
  const lector = { usuario: 'e2e-lector', clave: clave(), correo: 'e2e-lector@finanzas.test' };
  prepararBase();
  await levantarApi({
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: apiUrl,
    ConnectionStrings__Finanzas: `Host=localhost;Port=${puertoPostgres};Database=${dbName};Username=finanzas;Password=finanzas-local-dev`,
    Security__PasswordLogin__Enabled: 'true',
    Security__PasswordLogin__Accounts__50__UserName: propietario.usuario,
    Security__PasswordLogin__Accounts__50__Email: propietario.correo,
    Security__PasswordLogin__Accounts__50__Name: 'Propietario E2E',
    Security__PasswordLogin__Accounts__50__Password: propietario.clave,
    Security__PasswordLogin__Accounts__51__UserName: lector.usuario,
    Security__PasswordLogin__Accounts__51__Email: lector.correo,
    Security__PasswordLogin__Accounts__51__Name: 'Lector E2E',
    Security__PasswordLogin__Accounts__51__Password: lector.clave,
    SuperAdmin__Email: propietario.correo,
  });
  const resultado = spawnSync('pnpm', ['e2e', ...process.argv.slice(2)], {
    cwd: webRoot,
    stdio: 'inherit',
    shell: esWindows,
    env: {
      ...process.env,
      API_BASE_URL: apiUrl,
      E2E_USER: propietario.usuario,
      E2E_PASSWORD: propietario.clave,
      E2E_VIEWER_USER: lector.usuario,
      E2E_VIEWER_PASSWORD: lector.clave,
    },
  });
  stopApi();
  process.exit(resultado.status ?? 1);
}

process.on('SIGINT', () => {
  stopApi();
  process.exit(130);
});

principal().catch((error) => fallar(String(error)));
