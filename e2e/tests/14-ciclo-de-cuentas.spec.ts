import type { Page, TestInfo } from '@playwright/test';
import { apiUrl, identificadorDeCorrida } from '../support/entorno';
import { expect, test, type Semilla } from '../support/fixtures';
import { atajo, dialogo, elegir, guardarDialogo, ir, panelLateral } from '../support/ui';
import type { Vigilancia } from '../support/fixtures';

const tiposDeDebito = [
  { etiqueta: 'Ahorros', kind: 3 },
  { etiqueta: 'Cuenta corriente', kind: 2 },
  { etiqueta: 'Efectivo', kind: 1 },
  { etiqueta: 'Billetera digital', kind: 4 },
  { etiqueta: 'Otra', kind: 99 },
] as const;

interface CuentaApi {
  id: string;
  name: string;
  isActive: boolean;
}

interface TarjetaApi extends CuentaApi {
  terms: { applyPaymentPriority?: boolean };
}

const dinero = (monto: number) => ({ amount: String(monto), currency: 'COP' });

function haceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

async function escribirEnApi(page: Page, ruta: string, datos: object): Promise<void> {
  const { token } = (await (await page.request.get(`${apiUrl}/api/v1/auth/csrf`)).json()) as { token: string };
  const respuesta = await page.request.post(`${apiUrl}${ruta}`, { data: datos, headers: { 'X-CSRF-Token': token } });
  expect(respuesta.ok(), `${ruta}: ${await respuesta.text()}`).toBeTruthy();
}

async function reglasDe(page: Page, kind: number): Promise<{ effect: number; flow: number }> {
  const catalogo = await leer<{ kind: number; allowedEffects?: number[]; allowedFlows?: number[] }[] | { items: [] }>(
    page,
    '/api/v1/movement-kinds',
  );
  const lista = Array.isArray(catalogo) ? catalogo : catalogo.items;
  const regla = lista.find((e) => e.kind === kind);
  return { effect: regla?.allowedEffects?.[0] ?? 0, flow: regla?.allowedFlows?.[0] ?? 0 };
}

async function leer<T>(page: Page, ruta: string): Promise<T> {
  return (await (await page.request.get(`${apiUrl}${ruta}`)).json()) as T;
}

async function capturar(page: Page, info: TestInfo, nombre: string): Promise<void> {
  const ruta = info.outputPath(`${nombre}.png`);
  await page.screenshot({ path: ruta });
  await info.attach(nombre, { path: ruta, contentType: 'image/png' });
}

async function abrirDetalle(page: Page, nombre: string) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const pagina = page.locator('main');
  await pagina.getByPlaceholder('Nombre o terminación').fill(nombre);
  await pagina.getByRole('button', { name: nombre, exact: true }).click();
  await pagina.getByRole('button', { name: 'Ver extracto y detalle' }).click();
  const detalle = panelLateral(page);
  await expect(detalle.getByText('Últimos movimientos')).toBeVisible();
  return detalle;
}

async function renombrar(page: Page, vigilancia: Vigilancia, detalle: ReturnType<typeof panelLateral>, nombre: string) {
  await detalle.getByRole('button', { name: 'Editar', exact: true }).click();
  const formulario = dialogo(page);
  await formulario.locator('input[name="cuenta.name"]').fill(nombre);
  await guardarDialogo(page, vigilancia, /(PUT|PATCH) .*(accounts|cards)/);
  await expect(formulario).toBeHidden();
}

async function desactivar(page: Page, vigilancia: Vigilancia, detalle: ReturnType<typeof panelLateral>) {
  await detalle.getByRole('button', { name: 'Desactivar cuenta' }).click();
  const marca = vigilancia.marca();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Desactivar cuenta' }).click();
  await expect.poll(() => vigilancia.exitosasDesde(marca, /(accounts|cards)/).length).toBeGreaterThan(0);
}

test.describe.configure({ mode: 'serial' });

test.describe('Ciclo de cuentas', () => {
  for (const tipo of tiposDeDebito) {
    test(`CTA-20 «${tipo.etiqueta}»: crear, recibir movimientos, editar y desactivar`, async ({
      page,
      vigilancia,
      semilla,
    }, info) => {
      const nombre = `E2E Ciclo ${tipo.kind} ${identificadorDeCorrida}`;
      await ir(page, 'accounts');
      await atajo(page, 'n', 'c');
      const formulario = dialogo(page);
      await elegir(formulario, 'Tipo de cuenta', new RegExp(`^\\s*${tipo.etiqueta}\\s*$`));
      await formulario.locator('input[name="cuenta.name"]').fill(nombre);
      await formulario.locator('input[name="cuenta.opening"]').fill('100000');
      await capturar(page, info, '1-crear');
      await guardarDialogo(page, vigilancia, /POST .*accounts/);

      const cuenta = (await leer<CuentaApi[]>(page, '/api/v1/accounts')).find((c) => c.name === nombre)!;
      expect(cuenta, 'la cuenta existe en la API').toBeTruthy();
      await registrarMovimientos(page, semilla, cuenta.id, nombre);

      const detalle = await abrirDetalle(page, nombre);
      await expect(detalle.getByText(`Ingreso ${nombre}`)).toBeVisible();
      await expect(detalle.getByText(`Gasto ${nombre}`)).toBeVisible();
      await capturar(page, info, '2-detalle-con-movimientos');

      const editada = `${nombre} editada`;
      await renombrar(page, vigilancia, detalle, editada);
      await expect
        .poll(async () => (await leer<CuentaApi[]>(page, '/api/v1/accounts')).some((c) => c.name === editada))
        .toBe(true);
      await capturar(page, info, '3-editada');

      await desactivar(page, vigilancia, detalle);
      await expect
        .poll(
          async () =>
            (await leer<CuentaApi[]>(page, '/api/v1/accounts')).find((c) => c.id === cuenta.id)?.isActive ?? false,
        )
        .toBe(false);
      await capturar(page, info, '4-desactivada');
    });
  }

  test('CTA-21 tarjeta que paga primero la deuda más vieja: crear, compras, abono, editar y desactivar', async ({
    page,
    vigilancia,
    semilla,
  }, info) => {
    const nombre = `E2E Tarjeta antigua ${identificadorDeCorrida}`;
    await ir(page, 'accounts');
    await atajo(page, 'n', 'c');
    const formulario = dialogo(page);
    await elegir(formulario, 'Tipo de cuenta', /^\s*Crédito\s*$/);
    await formulario.locator('input[name="cuenta.name"]').fill(nombre);
    await formulario.locator('input[name="cuenta.limit"]').fill('5000000');
    await formulario.locator('input[name="cuenta.cutDay"]').fill('20');
    await formulario.locator('input[name="cuenta.dueDay"]').fill('5');
    await formulario.getByText('Aplicar orden de prioridad').click();
    await expect(formulario.getByText('El abono paga primero la deuda más vieja.')).toBeVisible();
    await capturar(page, info, '1-crear-tarjeta');
    await guardarDialogo(page, vigilancia, /POST .*cards/);

    const tarjeta = (await leer<TarjetaApi[]>(page, '/api/v1/cards')).find((c) => c.name === nombre)!;
    expect(tarjeta?.terms.applyPaymentPriority, 'la API guarda «deuda más vieja primero»').toBe(false);

    const reglasDeCompra = await reglasDe(page, 20);
    const compra = (clave: string, dias: number, monto: number) =>
      escribirEnApi(page, '/api/v1/movements', {
        date: haceDias(dias),
        kind: 20,
        ...reglasDeCompra,
        amount: dinero(monto),
        links: { card: tarjeta.id, category: semilla.catalogos['mercado'] },
        description: `Compra ${clave} ${nombre}`,
        idempotencyKey: `e2e-ciclo-${clave}-${identificadorDeCorrida}`,
      });
    await compra('vieja', 60, 200_000);
    await escribirEnApi(page, '/api/v1/operations/cash-advances', {
      date: haceDias(30),
      amount: dinero(300_000),
      card: tarjeta.id,
      account: semilla.cuentas.ahorros,
      description: `Avance ${nombre}`,
      idempotencyKey: `e2e-ciclo-avance-${identificadorDeCorrida}`,
    });
    await compra('nueva', 5, 100_000);

    const detalle = await abrirDetalle(page, nombre);
    await capturar(page, info, '2-detalle-tarjeta');
    await detalle.getByRole('button', { name: 'Registrar abono' }).click();
    await detalle.locator('input[type=number]').first().fill('250000');
    await expect(detalle.getByText(/paga primero la deuda más vieja/)).toBeVisible();
    const fila = (concepto: string) => detalle.locator('tr', { hasText: concepto });
    await expect(fila('Compras a una cuota'), 'la compra más vieja se paga completa').toContainText('COP 200.000');
    await expect(fila('Avances'), 'lo que sobra va al avance, que es la siguiente más vieja').toContainText(
      'COP 50.000',
    );
    await capturar(page, info, '3-simulacion-abono');

    const marca = vigilancia.marca();
    await detalle.getByRole('button', { name: /Confirmar abono/ }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /card-payments/).length).toBeGreaterThan(0);
    await capturar(page, info, '4-abono-registrado');

    await detalle.getByRole('button', { name: 'Editar', exact: true }).click();
    const edicion = dialogo(page);
    await edicion.getByText('Aplicar orden de prioridad').click();
    await expect(edicion.getByText('El abono se reparte en el orden de abajo.')).toBeVisible();
    await guardarDialogo(page, vigilancia, /(PUT|PATCH) .*cards/);
    await expect
      .poll(
        async () =>
          (await leer<TarjetaApi[]>(page, '/api/v1/cards')).find((c) => c.id === tarjeta.id)?.terms
            .applyPaymentPriority,
      )
      .toBe(true);

    await desactivar(page, vigilancia, panelLateral(page));
    await expect
      .poll(
        async () =>
          (await leer<TarjetaApi[]>(page, '/api/v1/cards')).find((c) => c.id === tarjeta.id)?.isActive ?? false,
      )
      .toBe(false);
    await capturar(page, info, '5-tarjeta-desactivada');
  });
});

async function registrarMovimientos(page: Page, semilla: Semilla, cuenta: string, nombre: string): Promise<void> {
  await escribirEnApi(page, '/api/v1/movements', {
    date: haceDias(2),
    kind: 1,
    ...(await reglasDe(page, 1)),
    amount: dinero(50_000),
    links: { account: cuenta, category: semilla.catalogos['salario'] },
    description: `Ingreso ${nombre}`,
    idempotencyKey: `e2e-ciclo-ingreso-${cuenta}`,
  });
  await escribirEnApi(page, '/api/v1/movements', {
    date: haceDias(1),
    kind: 2,
    ...(await reglasDe(page, 2)),
    amount: dinero(20_000),
    links: { account: cuenta, category: semilla.catalogos['mercado'] },
    description: `Gasto ${nombre}`,
    idempotencyKey: `e2e-ciclo-gasto-${cuenta}`,
  });
}
