import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { ClienteApi } from '../support/api';
import {
  apiUrl,
  credencialesLector,
  credencialesPropietario,
  directorioEstado,
  identificadorDeCorrida,
} from '../support/entorno';
import { expect, test, type Vigilancia } from '../support/fixtures';
import { nombres } from '../support/semilla';
import { atajo, buscarMovimientos, dialogo, elegir, guardarMovimiento, ir } from '../support/ui';

const corrida = identificadorDeCorrida;
const estadoSinTarjetas = join(directorioEstado, 'sin-tarjetas.json');

interface CuentaApi {
  id: string;
  name: string;
  kind: number;
  currency: string;
}
interface TarjetaApi {
  id: string;
  name: string;
  currency: string;
  lastFour?: string | null;
  issuerEntity?: { id: string } | null;
}
interface PersonaApi {
  id: string;
  displayName: string;
}

const cuentas = async (page: Page) =>
  (await (await page.request.get(`${apiUrl}/api/v1/accounts`)).json()) as CuentaApi[];
const tarjetas = async (page: Page) =>
  (await (await page.request.get(`${apiUrl}/api/v1/cards`)).json()) as TarjetaApi[];
const personas = async (page: Page) =>
  (await (await page.request.get(`${apiUrl}/api/v1/people`)).json()) as PersonaApi[];

async function vinculoDelMovimiento(page: Page, descripcion: string, id: string): Promise<void> {
  await expect
    .poll(
      async () => (await buscarMovimientos(page, descripcion)).some((m) => Object.values(m.links ?? {}).includes(id)),
      { message: `el movimiento «${descripcion}» debe quedar vinculado a ${id}` },
    )
    .toBe(true);
}

const selector = (formulario: Locator, etiqueta: string): Locator =>
  formulario.locator(`[data-slot=select-trigger][aria-label^="${etiqueta}"]`);

async function focoEnDialogo(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
}

async function abrirNuevo(page: Page, contenedor: Locator, boton: string): Promise<Locator> {
  await contenedor.getByRole('button', { name: boton, exact: true }).click();
  const nuevo = dialogo(page);
  await expect(nuevo.locator('input[name="cuenta.name"]')).toBeVisible();
  await expect.poll(() => focoEnDialogo(page), { message: 'el foco pasa al formulario nuevo' }).toBe(true);
  return nuevo;
}

async function guardarNuevo(page: Page, nuevo: Locator, patron: RegExp, vigilancia: Vigilancia): Promise<void> {
  const marca = vigilancia.marca();
  await nuevo.locator('button[type=submit]').click();
  await expect.poll(() => vigilancia.exitosasDesde(marca, patron).length).toBeGreaterThan(0);
  await expect(page.locator('input[name="cuenta.name"]')).toHaveCount(0);
}

test.describe('El «+» de alta en línea se entiende', () => {
  test.beforeEach(async ({ page }) => {
    await ir(page, 'movements');
  });

  test('ALT-01 el «+» de categoría pasa a «X» al abrir y vuelve a «+» al cancelar', async ({ page }) => {
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    const boton = formulario.locator('[data-tour=form-categoria-nueva] button');
    await expect(boton).toHaveAccessibleName('Nueva categoría');
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(boton.locator('fin-icon[name=plus]')).toHaveCount(1);

    await boton.click();
    await expect(boton).toHaveAccessibleName('Cancelar');
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    await expect(boton.locator('fin-icon[name=close]')).toHaveCount(1);
    await expect(formulario.locator('input[name=nuevaCategoria]')).toBeVisible();

    await boton.click();
    await expect(boton).toHaveAccessibleName('Nueva categoría');
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(boton.locator('fin-icon[name=plus]')).toHaveCount(1);
    await expect(formulario.locator('input[name=nuevaCategoria]')).toHaveCount(0);
  });

  test('ALT-02 Escape dentro del alta la cancela sin cerrar el formulario ni borrar lo escrito', async ({ page }) => {
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await formulario.locator('input[name=description]').fill('E2E se conserva');
    await formulario.locator('[data-tour=form-categoria-nueva] button').click();
    const alta = formulario.locator('input[name=nuevaCategoria]');
    await alta.fill('Borrador');
    await alta.press('Escape');

    await expect(alta).toHaveCount(0);
    await expect(formulario).toBeVisible();
    await expect(formulario.locator('input[name=description]')).toHaveValue('E2E se conserva');
    await expect(formulario.locator('[data-tour=form-categoria-nueva] button')).toBeFocused();

    await formulario.locator('input[name=description]').press('Escape');
    await expect(formulario).toBeHidden();
  });

  test('ALT-03 el «+» de persona se comporta igual que el de categoría', async ({ page }) => {
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await elegir(formulario, 'Tipo:', 'Compra con tarjeta prestada');
    const boton = formulario.locator('[data-tour=form-contraparte-nueva] button');
    await expect(boton).toHaveAccessibleName('Nueva persona');

    await boton.click();
    await expect(boton).toHaveAccessibleName('Cancelar');
    await expect(boton.locator('fin-icon[name=close]')).toHaveCount(1);
    await formulario.locator('input[name=nuevaContraparte]').press('Escape');

    await expect(formulario.locator('input[name=nuevaContraparte]')).toHaveCount(0);
    await expect(formulario).toBeVisible();
    await expect(boton).toHaveAccessibleName('Nueva persona');
  });
});

test.describe.configure({ mode: 'serial' });

test.describe('Crear al vuelo desde el formulario de movimiento', () => {
  test.beforeEach(async ({ page }) => {
    await ir(page, 'movements');
  });

  test('AVU-01 cuenta de origen: se crea, queda seleccionada y el gasto se vincula a ella', async ({
    page,
    vigilancia,
  }) => {
    const nombre = `E2E Ahorros al vuelo ${corrida}`;
    const descripcion = `E2E gasto cuenta nueva ${corrida}`;
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await formulario.locator('input[name=amount]').fill('11000');
    await formulario.locator('input[name=description]').fill(descripcion);
    const nuevo = await abrirNuevo(page, formulario, 'Nueva cuenta');
    await elegir(nuevo, 'Tipo de cuenta', /Ahorros/);
    await nuevo.locator('input[name="cuenta.name"]').fill(nombre);
    await nuevo.locator('input[name="cuenta.lastFour"]').fill('1234');
    await guardarNuevo(page, nuevo, /POST .*accounts/, vigilancia);

    const creada = (await cuentas(page)).find((c) => c.name === nombre);
    expect(creada, 'la cuenta existe en la API').toBeTruthy();
    expect(creada).toMatchObject({ kind: 3, currency: 'COP' });
    await expect(selector(formulario, 'Cuenta o tarjeta')).toContainText(nombre);
    await expect(selector(formulario, 'Cuenta o tarjeta')).toBeFocused();
    await expect(formulario.locator('input[name=amount]')).toHaveValue('11.000');
    await expect(formulario.locator('input[name=description]')).toHaveValue(descripcion);

    await guardarMovimiento(page, vigilancia, {
      monto: 11_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await vinculoDelMovimiento(page, descripcion, creada!.id);
  });

  test('AVU-02 tarjeta y emisor: crea el emisor dentro de la tarjeta y la compra queda en ella', async ({
    page,
    vigilancia,
  }) => {
    const nombre = `E2E Tarjeta al vuelo ${corrida}`;
    const emisor = `E2E Emisor al vuelo ${corrida}`;
    const descripcion = `E2E compra tarjeta nueva ${corrida}`;
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    const nuevo = await abrirNuevo(page, formulario, 'Nueva cuenta');
    await elegir(nuevo, 'Tipo de cuenta', /Crédito/);
    await nuevo.locator('input[name="cuenta.name"]').fill(nombre);
    await nuevo.locator('input[name="cuenta.lastFour"]').fill('9876');
    const entidad = nuevo.getByRole('combobox', { name: /Entidad emisora/ });
    await entidad.fill(emisor);
    const marca = vigilancia.marca();
    await page.getByRole('option', { name: `Crear «${emisor}»` }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*people/).length).toBeGreaterThan(0);
    await expect(entidad).toHaveValue(emisor);
    await guardarNuevo(page, nuevo, /POST .*cards/, vigilancia);

    const creadoEmisor = (await personas(page)).find((p) => p.displayName === emisor);
    expect(creadoEmisor, 'el emisor existe').toBeTruthy();
    const creada = (await tarjetas(page)).find((t) => t.name === nombre);
    expect(creada, 'la tarjeta existe en la API').toBeTruthy();
    expect(creada).toMatchObject({ currency: 'COP', lastFour: '9876' });
    expect(creada?.issuerEntity?.id, 'la tarjeta quedó con ese emisor').toBe(creadoEmisor!.id);
    await expect(selector(formulario, 'Cuenta o tarjeta')).toContainText(nombre);

    await guardarMovimiento(page, vigilancia, {
      monto: 21_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await vinculoDelMovimiento(page, descripcion, creada!.id);
  });

  test('AVU-03 cuenta destino de una transferencia: hereda la moneda del origen', async ({ page, vigilancia }) => {
    const nombre = `E2E Destino al vuelo ${corrida}`;
    const descripcion = `E2E transferencia destino nuevo ${corrida}`;
    await atajo(page, 'n', 't');
    const formulario = dialogo(page);
    const nuevo = await abrirNuevo(page, formulario.locator('[data-tour=form-cuenta-destino]'), 'Nueva cuenta');
    await elegir(nuevo, 'Tipo de cuenta', /Cuenta corriente/);
    await nuevo.locator('input[name="cuenta.name"]').fill(nombre);
    await nuevo.locator('input[name="cuenta.lastFour"]').fill('5678');
    await guardarNuevo(page, nuevo, /POST .*accounts/, vigilancia);

    const creada = (await cuentas(page)).find((c) => c.name === nombre);
    expect(creada, 'la cuenta destino existe').toBeTruthy();
    expect(creada).toMatchObject({ kind: 2, currency: 'COP' });
    await expect(selector(formulario, 'Cuenta destino')).toContainText(nombre);
    await expect(selector(formulario, 'Cuenta destino')).toBeFocused();

    await guardarMovimiento(page, vigilancia, { monto: 5_000, descripcion });
    await vinculoDelMovimiento(page, descripcion, creada!.id);
  });

  test('AVU-04 tarjeta del avance: solo ofrece tarjeta y el avance queda en la nueva', async ({ page, vigilancia }) => {
    const nombre = `E2E Tarjeta avance ${corrida}`;
    const descripcion = `E2E avance tarjeta nueva ${corrida}`;
    await atajo(page, 'n', 'a');
    const formulario = dialogo(page);
    const nuevo = await abrirNuevo(page, formulario, 'Nueva tarjeta');
    await expect(nuevo.locator('input[name="cuenta.limit"]')).toBeVisible();
    await nuevo.locator('input[name="cuenta.name"]').fill(nombre);
    await nuevo.locator('input[name="cuenta.lastFour"]').fill('2468');
    await guardarNuevo(page, nuevo, /POST .*cards/, vigilancia);

    const creada = (await tarjetas(page)).find((t) => t.name === nombre);
    expect(creada, 'la tarjeta existe en la API').toBeTruthy();
    expect(creada).toMatchObject({ currency: 'COP', lastFour: '2468' });
    await expect(selector(formulario, 'Tarjeta del avance')).toContainText(nombre);

    await guardarMovimiento(page, vigilancia, {
      monto: 100_000,
      descripcion,
      selecciones: { 'Cuenta donde entra el efectivo:': nombres.corriente },
    });
    await vinculoDelMovimiento(page, descripcion, creada!.id);
  });

  test('AVU-05 tarjeta prestada: la persona que presta se crea con el «+» y el movimiento la usa', async ({
    page,
    vigilancia,
  }) => {
    const nombre = `E2E Prestamista al vuelo ${corrida}`;
    const descripcion = `E2E tarjeta prestada nueva ${corrida}`;
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await elegir(formulario, 'Tipo:', 'Compra con tarjeta prestada');
    await formulario.locator('input[name=borrowedCardName]').fill('Visa prestada');
    await formulario.getByRole('button', { name: /^Nueva (persona|entidad)$/ }).click();
    await formulario.locator('input[name=nuevaContraparte]').fill(nombre);
    const marca = vigilancia.marca();
    await formulario.getByRole('button', { name: 'Agregar' }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*people/).length).toBeGreaterThan(0);

    const creada = (await personas(page)).find((p) => p.displayName === nombre);
    expect(creada, 'la persona existe en la API').toBeTruthy();
    await expect(selector(formulario, '¿Quién te prestó la tarjeta?')).toContainText(nombre);

    await guardarMovimiento(page, vigilancia, { monto: 33_000, descripcion });
    await expect
      .poll(
        async () => {
          const cuerpo = await (await page.request.get(`${apiUrl}/api/v1/obligations`)).json();
          const lista: { counterparty: { id: string }; terms?: { borrowedCard?: boolean } }[] = Array.isArray(cuerpo)
            ? cuerpo
            : (cuerpo.items ?? []);
          return lista.some((o) => o.counterparty.id === creada!.id);
        },
        { message: 'la deuda de la tarjeta prestada queda con la persona nueva' },
      )
      .toBe(true);
  });

  test('AVU-06 cancelar la creación conserva lo escrito en el movimiento', async ({ page, vigilancia }) => {
    const descripcion = `E2E conserva ${corrida}`;
    const nombre = `E2E Cancelada ${corrida}`;
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await formulario.locator('input[name=amount]').fill('45678');
    await formulario.locator('input[name=description]').fill(descripcion);
    await elegir(formulario, 'Categoría:', nombres.mercado);

    const nuevo = await abrirNuevo(page, formulario, 'Nueva cuenta');
    await nuevo.locator('input[name="cuenta.name"]').fill(nombre);
    const marca = vigilancia.marca();
    await nuevo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('input[name="cuenta.name"]')).toHaveCount(0);

    await expect(formulario.locator('input[name=amount]')).toHaveValue('45.678');
    await expect(formulario.locator('input[name=description]')).toHaveValue(descripcion);
    await expect(selector(formulario, 'Categoría')).toContainText(nombres.mercado);
    await expect(selector(formulario, 'Cuenta o tarjeta')).toBeFocused();
    expect(vigilancia.escriturasDesde(marca)).toEqual([]);
    expect((await cuentas(page)).some((c) => c.name === nombre)).toBe(false);
  });

  test('AVU-07 datos inválidos: avisa en el campo y el movimiento queda intacto', async ({ page, vigilancia }) => {
    const descripcion = `E2E invalidos ${corrida}`;
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await formulario.locator('input[name=amount]').fill('777');
    await formulario.locator('input[name=description]').fill(descripcion);

    const nuevo = await abrirNuevo(page, formulario, 'Nueva cuenta');
    await elegir(nuevo, 'Tipo de cuenta', /Crédito/);
    await nuevo.locator('input[name="cuenta.name"]').fill(`E2E Invalida ${corrida}`);
    await nuevo.locator('input[name="cuenta.lastFour"]').fill('12');
    const marca = vigilancia.marca();
    await nuevo.locator('button[type=submit]').click();
    await expect(nuevo).toContainText('deben ser cuatro números');
    expect(vigilancia.escriturasDesde(marca)).toEqual([]);

    await nuevo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario.locator('input[name=amount]')).toHaveValue('777');
    await expect(formulario.locator('input[name=description]')).toHaveValue(descripcion);
  });
});

async function sesionSinPermisoDeTarjetas(): Promise<() => Promise<void>> {
  const lector = credencialesLector()!;
  const propietario = credencialesPropietario();
  const sesionLector = new ClienteApi();
  await sesionLector.iniciarSesion(lector.usuario, lector.clave);
  const { user, organization } = await sesionLector.exigir('GET', '/api/v1/session');

  const admin = new ClienteApi();
  await admin.iniciarSesion(propietario.usuario, propietario.clave);
  const roles = await admin.exigir('GET', `/api/v1/superadmin/roles?organizationId=${organization.id}&size=100`);
  const propietarioRol = roles.items.find((rol: any) => rol.name === 'Propietario');
  if (!propietarioRol) throw new Error('La organización del lector no tiene el rol Propietario.');
  const usuarios = await admin.exigir(
    'GET',
    `/api/v1/superadmin/users?search=${encodeURIComponent(user.email ?? lector.usuario)}&size=20`,
  );
  const ficha = usuarios.items.find((u: any) => u.id === user.id);
  const anteriores: string[] = (ficha?.memberships ?? [])
    .filter((m: any) => m.organizationId === organization.id)
    .flatMap((m: any) => m.roles.map((r: any) => r.id));

  const rol = await admin.exigir('POST', '/api/v1/superadmin/roles', {
    organizationId: organization.id,
    name: `E2E sin tarjetas ${corrida}`,
    description: 'Propietario sin cuentas.tarjetas.crear',
    capabilities: [],
    permissions: propietarioRol.permissions.filter((permiso: string) => permiso !== 'cuentas.tarjetas.crear'),
  });
  await admin.exigir('PUT', `/api/v1/superadmin/users/${user.id}/roles`, {
    organizationId: organization.id,
    roleIds: [rol.id],
  });

  const nueva = new ClienteApi();
  await nueva.iniciarSesion(lector.usuario, lector.clave);
  writeFileSync(estadoSinTarjetas, JSON.stringify(nueva.estadoDeAlmacenamiento()));

  return async () => {
    await admin.exigir('PUT', `/api/v1/superadmin/users/${user.id}/roles`, {
      organizationId: organization.id,
      roleIds: anteriores,
    });
    await admin.exigir('PUT', `/api/v1/superadmin/roles/${rol.id}/active`, { isActive: false });
  };
}

test.describe('Crear al vuelo en tableta 1024x768 táctil', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('AVU-09 la hoja de cuenta se abre encima de la de movimiento y al cerrarla reaparece intacta', async ({
    page,
    vigilancia,
  }) => {
    const nombre = `E2E Tableta al vuelo ${corrida}`;
    const descripcion = `E2E tableta cuenta nueva ${corrida}`;
    await ir(page, 'movements');
    await atajo(page, 'n', 'g');
    const formulario = dialogo(page);
    await expect(formulario).toHaveAttribute('data-superficie', 'hoja');
    await formulario.locator('input[name=description]').fill(descripcion);

    const nuevo = await abrirNuevo(page, formulario, 'Nueva cuenta');
    await expect(nuevo).toHaveAttribute('data-superficie', 'hoja');
    await elegir(nuevo, 'Tipo de cuenta', /Ahorros/);
    await nuevo.locator('input[name="cuenta.name"]').fill(nombre);
    await nuevo.locator('input[name="cuenta.lastFour"]').fill('1357');
    await guardarNuevo(page, nuevo, /POST .*accounts/, vigilancia);

    const creada = (await cuentas(page)).find((c) => c.name === nombre);
    expect(creada, 'la cuenta existe en la API').toBeTruthy();
    await expect(formulario).toHaveAttribute('data-superficie', 'hoja');
    await expect(selector(formulario, 'Cuenta o tarjeta')).toContainText(nombre);
    await expect(formulario.locator('input[name=description]')).toHaveValue(descripcion);

    await guardarMovimiento(page, vigilancia, {
      monto: 9_000,
      descripcion,
      selecciones: { 'Categoría:': nombres.mercado },
    });
    await vinculoDelMovimiento(page, descripcion, creada!.id);
  });
});

test.describe('Crear al vuelo sin permiso de tarjetas', () => {
  test.skip(!credencialesLector(), 'Define E2E_VIEWER_USER y E2E_VIEWER_PASSWORD para probar un rol sin permiso.');
  test.use({ storageState: estadoSinTarjetas });

  let restaurar: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    restaurar = await sesionSinPermisoDeTarjetas();
  });

  test.afterAll(async () => {
    await restaurar?.();
  });

  test('AVU-08 sin cuentas.tarjetas.crear no hay «+» de tarjeta y la API responde 403', async ({
    page,
    vigilancia,
  }) => {
    await ir(page, 'movements');
    await atajo(page, 'n', 'a');
    const avance = dialogo(page);
    await expect(selector(avance, 'Tarjeta del avance')).toBeVisible();
    await expect(avance.getByRole('button', { name: 'Nueva tarjeta' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(avance).toBeHidden();

    await atajo(page, 'n', 'g');
    const gasto = dialogo(page);
    const nuevo = await abrirNuevo(page, gasto, 'Nueva cuenta');
    await selector(nuevo, 'Tipo de cuenta').click();
    await expect(page.locator('[role=option]').first()).toBeVisible();
    await expect(page.locator('[role=option]').filter({ hasText: /Crédito/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const respuesta = await page.request.post(`${apiUrl}/api/v1/cards`, {
      data: { name: 'No debe existir', currency: 'COP' },
    });
    expect(respuesta.status()).toBe(403);
    vigilancia.aceptarErroresEsperados();
  });
});
