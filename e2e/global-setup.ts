import { mkdirSync, writeFileSync } from 'node:fs';
import { ClienteApi } from './support/api';
import {
  archivoSemilla,
  credencialesLector,
  credencialesPropietario,
  directorioEstado,
  estadoLector,
  estadoPropietario,
} from './support/entorno';
import { sembrarBase } from './support/semilla';

async function asignarRolPropietario(api: ClienteApi): Promise<void> {
  const sesion = await api.exigir('GET', '/api/v1/session');
  if (sesion.permissions.includes('movimientos.crear')) return;
  const organizacion = sesion.organization.id;
  const roles = await api.exigir('GET', `/api/v1/superadmin/roles?organizationId=${organizacion}&size=100`);
  const propietario = roles.items.find((rol: any) => rol.name === 'Propietario' && rol.organizationId === organizacion);
  if (!propietario) throw new Error('La organización de la cuenta de prueba no tiene el rol Propietario.');
  await api.exigir('PUT', `/api/v1/superadmin/users/${sesion.user.id}/roles`, {
    organizationId: organizacion,
    roleIds: [propietario.id],
  });
}

async function restablecerIdioma(api: ClienteApi): Promise<void> {
  const preferencias = await api.exigir('GET', '/api/v1/preferences');
  if (preferencias.language === 'es-CO') return;
  await api.exigir('PUT', '/api/v1/preferences', { ...preferencias, language: 'es-CO' });
}

async function sesionDelLector(): Promise<void> {
  const credenciales = credencialesLector();
  if (!credenciales) return;
  const api = new ClienteApi();
  await api.iniciarSesion(credenciales.usuario, credenciales.clave);
  writeFileSync(estadoLector, JSON.stringify(api.estadoDeAlmacenamiento()));
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(directorioEstado, { recursive: true });
  const credenciales = credencialesPropietario();
  const api = new ClienteApi();
  await api.iniciarSesion(credenciales.usuario, credenciales.clave);
  await asignarRolPropietario(api);
  await restablecerIdioma(api);
  const ids = await sembrarBase(api);
  writeFileSync(archivoSemilla, JSON.stringify(ids));
  writeFileSync(estadoPropietario, JSON.stringify(api.estadoDeAlmacenamiento()));
  await sesionDelLector();
}
