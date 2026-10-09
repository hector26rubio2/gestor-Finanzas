import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const apiUrl = (process.env.API_BASE_URL ?? 'http://localhost:5198').replace(/\/$/, '');
export const webUrl = (process.env.E2E_BASE_URL ?? 'http://localhost:4300').replace(/\/$/, '');

export const directorioEstado = join(__dirname, '..', '.estado');
export const estadoPropietario = join(directorioEstado, 'propietario.json');
export const estadoLector = join(directorioEstado, 'lector.json');
export const archivoSemilla = join(directorioEstado, 'semilla.json');

export interface Credenciales {
  usuario: string;
  clave: string;
}

function credenciales(prefijo: string): Credenciales | null {
  const usuario = process.env[`${prefijo}_USER`];
  const clave = process.env[`${prefijo}_PASSWORD`];
  return usuario && clave ? { usuario, clave } : null;
}

export function credencialesPropietario(): Credenciales {
  const encontradas = credenciales('E2E');
  if (!encontradas)
    throw new Error('Faltan E2E_USER y E2E_PASSWORD: cuenta de prueba con login por contraseña del API local.');
  return encontradas;
}

export const credencialesLector = (): Credenciales | null => credenciales('E2E_VIEWER');

export const hayEstadoLector = (): boolean => existsSync(estadoLector);

export const identificadorDeCorrida = (process.env.E2E_RUN_ID ?? Date.now().toString(36)).toLowerCase();
