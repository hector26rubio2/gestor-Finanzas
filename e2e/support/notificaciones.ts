import { expect, type APIResponse, type Page } from '@playwright/test';
import { apiUrl } from './entorno';

interface Rol {
  id: string;
  name: string;
  organizationId: string;
}

export async function generarNotificacionDeRoles(page: Page): Promise<void> {
  const sesion = await (await page.request.get(`${apiUrl}/api/v1/session`)).json();
  const organizacion = sesion.organization.id as string;
  const roles = await (
    await page.request.get(`${apiUrl}/api/v1/superadmin/roles?organizationId=${organizacion}&size=100`)
  ).json();
  const rolDe = (nombre: string) =>
    (roles.items as Rol[]).find((rol) => rol.name === nombre && rol.organizationId === organizacion)!;
  const asignar = (rol: Rol): Promise<APIResponse> =>
    page.request.put(`${apiUrl}/api/v1/superadmin/users/${sesion.user.id}/roles`, {
      data: { organizationId: organizacion, roleIds: [rol.id] },
    });
  expect((await asignar(rolDe('Beta'))).status()).toBe(204);
  expect((await asignar(rolDe('Propietario'))).status()).toBe(204);
}
