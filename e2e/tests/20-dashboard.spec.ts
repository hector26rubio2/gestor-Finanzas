import { readFileSync } from 'node:fs';
import {
  apiUrl,
  archivoSemilla,
  credencialesLector,
  estadoPropietario,
  identificadorDeCorrida,
} from '../support/entorno';
import { contenedoresDeGraficaConScroll, desbordeHorizontal } from '../support/auditoria';
import { expect, test } from '../support/fixtures';
import { dialogo, elegir, panelLateral } from '../support/ui';
import { nombres } from '../support/semilla';
import {
  abrirTablero,
  aplicarFiltro,
  contextoCon,
  contextoDelLector,
  conteoDelResumen,
  escribirComo,
  contenedorDeTabla,
  desplazar,
  disenoDelTablero,
  etiquetaDeKpi,
  leerTablero,
  descripcionesDeLaTabla,
  elegirEscala,
  enRango,
  escalaDelPanel,
  etiquetaDelPeriodo,
  hoy,
  iniciarApi,
  kpisRecortados,
  movimientosDelRango,
  numeroDe,
  numeroDeKpi,
  quitarFiltro,
  rangoDe,
  tablerosDelUsuario,
  valorDeKpiDeResumen,
  sumarDias,
  totalesDe,
  totalesDelServidor,
  type Escala,
} from '../support/tablero';

const corrida = identificadorDeCorrida;
const semilla = () => JSON.parse(readFileSync(archivoSemilla, 'utf8'));

const categoriaPeriodo = `E2E Periodo ${corrida}`;
const fechas = { hoy: hoy(), hace8: sumarDias(hoy(), -8), hace40: sumarDias(hoy(), -40) };
const montos = { hoy: 11_000, hace8: 22_000, hace40: 33_000 };
const descripciones = {
  hoy: `E2E periodo hoy ${corrida}`,
  hace8: `E2E periodo hace 8 días ${corrida}`,
  hace40: `E2E periodo hace 40 días ${corrida}`,
};

async function sembrarGasto(
  api: Awaited<ReturnType<typeof iniciarApi>>,
  clave: string,
  fecha: string,
  monto: number,
  categoria: string,
  descripcion: string,
  cuenta: string = semilla().cuentas.ahorros,
) {
  return api.exigir('POST', '/api/v1/movements', {
    date: fecha,
    kind: 2,
    effect: 2,
    flow: 2,
    amount: { amount: String(monto), currency: 'COP' },
    links: { account: cuenta, category: categoria },
    description: descripcion,
    idempotencyKey: `e2e-das-${corrida}-${clave}`,
  });
}

async function crearCategoria(api: Awaited<ReturnType<typeof iniciarApi>>, nombre: string, tipo = 2) {
  const creada = await api.exigir('POST', '/api/v1/categories', {
    name: nombre,
    type: tipo,
    color: '#7c3aed',
    icon: 'cart',
  });
  return creada.id as string;
}

test.describe.configure({ mode: 'serial' });

async function borrarTablerosDeLaPrueba() {
  const api = await iniciarApi();
  const tableros = (await api.exigir('GET', '/api/v1/dashboards')) as { id: string; name: string }[];
  for (const tablero of tableros.filter((x) => x.name.startsWith('E2E ')))
    await api.llamar('DELETE', `/api/v1/dashboards/${tablero.id}`);
}

test.beforeAll(borrarTablerosDeLaPrueba);
test.afterAll(borrarTablerosDeLaPrueba);

test.describe('Tablero: periodo, filtros y cifras', () => {
  let categoria = '';

  test.beforeAll(async () => {
    const api = await iniciarApi();
    categoria = await crearCategoria(api, categoriaPeriodo);
    for (const clave of ['hoy', 'hace8', 'hace40'] as const)
      await sembrarGasto(api, clave, fechas[clave], montos[clave], categoria, descripciones[clave]);
  });

  test('DAS-10 el periodo (día, semana, mes, año) y las flechas mueven el rango y las cifras', async ({ page }) => {
    await abrirTablero(page);
    await aplicarFiltro(page, 'categoria', categoriaPeriodo);
    await elegirEscala(page, 'Mes');
    const casos: { escala: Escala; nombre: 'Día' | 'Semana' | 'Mes' | 'Año' }[] = [
      { escala: 'day', nombre: 'Día' },
      { escala: 'week', nombre: 'Semana' },
      { escala: 'month', nombre: 'Mes' },
      { escala: 'year', nombre: 'Año' },
    ];
    for (const { escala, nombre } of casos) {
      await elegirEscala(page, nombre);
      const rango = rangoDe(hoy(), escala);
      const esperados = (['hoy', 'hace8', 'hace40'] as const).filter((clave) => enRango(fechas[clave], rango));
      const gasto = esperados.reduce((suma, clave) => suma + montos[clave], 0);
      await expect.poll(() => numeroDeKpi(page, 'Gastos'), { message: `gastos en ${nombre}` }).toBe(gasto);
      await expect.poll(() => conteoDelResumen(page), { message: `conteo en ${nombre}` }).toBe(esperados.length);
      await expect
        .poll(async () => (await descripcionesDeLaTabla(page).catch(() => [])).sort(), {
          message: `tabla en ${nombre}`,
        })
        .toEqual(esperados.map((clave) => descripciones[clave]).sort());
      await expect(page).toHaveURL(escala === 'month' ? /^(?!.*escala=)/ : new RegExp(`escala=${escala}`));
    }

    await elegirEscala(page, 'Mes');
    const mesActual = rangoDe(hoy(), 'month');
    const anterior = rangoDe(desplazar(hoy(), 'month', -1), 'month');
    const etiquetaActual = (await etiquetaDelPeriodo(page).textContent())?.trim();
    await page.getByRole('button', { name: 'Periodo anterior' }).click();
    await expect.poll(async () => (await etiquetaDelPeriodo(page).textContent())?.trim()).not.toBe(etiquetaActual);
    const enAnterior = (['hoy', 'hace8', 'hace40'] as const).filter((c) => enRango(fechas[c], anterior));
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(enAnterior.reduce((suma, c) => suma + montos[c], 0));
    await page.getByRole('button', { name: 'Periodo siguiente' }).click();
    await expect.poll(async () => (await etiquetaDelPeriodo(page).textContent())?.trim()).toBe(etiquetaActual);
    const enActual = (['hoy', 'hace8', 'hace40'] as const).filter((c) => enRango(fechas[c], mesActual));
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(enActual.reduce((suma, c) => suma + montos[c], 0));

    await elegirEscala(page, 'Día');
    await page.getByRole('button', { name: 'Periodo anterior' }).click();
    const ancla = sumarDias(mesActual.start, -1);
    const ayer = rangoDe(ancla, 'day');
    const enAyer = (['hoy', 'hace8', 'hace40'] as const).filter((c) => enRango(fechas[c], ayer));
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(enAyer.reduce((suma, c) => suma + montos[c], 0));
    await expect(page).toHaveURL(new RegExp(`fecha=${ancla}`));
  });

  test('DAS-12 los KPI coinciden con lo que calcula la API y no se recortan', async ({ page }) => {
    await abrirTablero(page);
    for (const escala of [
      { escala: 'month' as const, nombre: 'Mes' as const },
      { escala: 'year' as const, nombre: 'Año' as const },
    ]) {
      await elegirEscala(page, escala.nombre);
      const rango = rangoDe(hoy(), escala.escala);
      const movimientos = await movimientosDelRango(page, rango);
      const calculado = totalesDe(movimientos);
      const servidor = await totalesDelServidor(page, rango);
      expect(servidor.ingresos, 'ingresos del API de resumen vs libro').toBe(calculado.ingresos);
      expect(servidor.gastos, 'gastos del API de resumen vs libro').toBe(calculado.gastos);
      await expect.poll(() => numeroDeKpi(page, 'Ingresos'), { message: 'Ingresos' }).toBe(calculado.ingresos);
      await expect.poll(() => numeroDeKpi(page, 'Gastos'), { message: 'Gastos' }).toBe(calculado.gastos);
      await expect
        .poll(() => numeroDeKpi(page, 'Balance del periodo'), { message: 'Balance' })
        .toBe(calculado.ingresos - calculado.gastos);
      await expect.poll(() => numeroDeKpi(page, 'Movimientos'), { message: 'Movimientos' }).toBe(movimientos.length);
      await expect.poll(() => conteoDelResumen(page)).toBe(movimientos.length);
      if (calculado.ingresos > 0) {
        const tasa = Math.round(((calculado.ingresos - calculado.gastos) / calculado.ingresos) * 100);
        await expect.poll(async () => numeroDeKpi(page, 'Tasa de ahorro (%)')).toBe(tasa);
      }
      expect(await kpisRecortados(page), 'KPI con texto recortado').toEqual([]);
      expect((await desbordeHorizontal(page)).scroll).toBeLessThanOrEqual((await desbordeHorizontal(page)).vista + 1);
      expect(await contenedoresDeGraficaConScroll(page)).toEqual([]);
    }
  });

  test('DAS-11 los filtros de cuenta, tipo y categoría cambian cifras y tabla, y quitarlos vuelve al total', async ({
    page,
  }) => {
    await abrirTablero(page);
    await elegirEscala(page, 'Año');
    const rango = rangoDe(hoy(), 'year');
    const todos = await movimientosDelRango(page, rango);
    const total = totalesDe(todos);
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(total.gastos);

    const deCuenta = todos.filter((m) => m.linkNames.account?.name === nombres.efectivo);
    expect(deCuenta.length).toBeGreaterThan(0);
    await aplicarFiltro(page, 'cuenta', nombres.efectivo);
    const porCuenta = totalesDe(deCuenta);
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(porCuenta.gastos);
    await expect.poll(() => numeroDeKpi(page, 'Ingresos')).toBe(porCuenta.ingresos);
    await expect.poll(() => numeroDeKpi(page, 'Movimientos')).toBe(deCuenta.length);
    await expect(page).toHaveURL(/cuenta=/);
    await expect.poll(async () => (await descripcionesDeLaTabla(page)).length).toBe(Math.min(15, deCuenta.length));
    await quitarFiltro(page, 'Cuenta');
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(total.gastos);
    await expect(page).not.toHaveURL(/cuenta=/);

    const deCategoria = todos.filter((m) => m.linkNames.category?.name === nombres.restaurantes);
    await aplicarFiltro(page, 'categoria', nombres.restaurantes);
    const porCategoria = totalesDe(deCategoria);
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(porCategoria.gastos);
    await expect.poll(() => numeroDeKpi(page, 'Movimientos')).toBe(deCategoria.length);
    await expect(page).toHaveURL(/categoria=/);

    await aplicarFiltro(page, 'cuenta', nombres.efectivo);
    const cruzado = totalesDe(deCategoria.filter((m) => m.linkNames.account?.name === nombres.efectivo));
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(cruzado.gastos);

    await aplicarFiltro(page, 'cuenta', nombres.corriente);
    await expect.poll(() => numeroDeKpi(page, 'Movimientos')).toBe(0);
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(0);
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(escalaDelPanel(page, 'Mes')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).not.toHaveURL(/escala=|cuenta=|categoria=/);
    const delMes = totalesDe(await movimientosDelRango(page, rangoDe(hoy(), 'month')));
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(delMes.gastos);
    await expect.poll(() => numeroDeKpi(page, 'Movimientos')).toBe(delMes.movimientos);
    await elegirEscala(page, 'Año');
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(total.gastos);
    await expect.poll(() => numeroDeKpi(page, 'Movimientos')).toBe(todos.length);

    const cuentasDeAhorro = todos.filter((m) => m.linkNames.account?.name === nombres.ahorros);
    await aplicarFiltro(page, 'tipo', /Cuentas? de ahorro|Ahorro/i);
    const porTipo = totalesDe(cuentasDeAhorro);
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(porTipo.gastos);
    await expect.poll(() => numeroDeKpi(page, 'Ingresos')).toBe(porTipo.ingresos);
    await expect(page).toHaveURL(/tipo=savings/);
    await quitarFiltro(page, 'Tipo');
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(total.gastos);
    await expect(page).not.toHaveURL(/tipo=/);
  });
});

test.describe('Tablero: widgets propios, orden, tipo y KPI con fórmula', () => {
  let tableroId = '';
  const nombreDelTablero = `E2E widgets ${corrida}`;

  test.beforeAll(async () => {
    const api = await iniciarApi();
    const creado = await api.exigir('POST', '/api/v1/dashboards', { name: nombreDelTablero });
    tableroId = creado.id;
  });

  const ruta = () => `dashboard?tablero=${tableroId}`;

  async function personalizar(page: import('@playwright/test').Page) {
    await abrirTablero(page, ruta());
    await page.getByRole('button', { name: 'Personalizar' }).click();
    await expect(page.locator('[data-slot=customize]')).toBeVisible();
  }

  async function esperarGuardado(
    page: import('@playwright/test').Page,
    vigilancia: { marca(): number; exitosasDesde(m: number, p?: RegExp): unknown[] },
    marca: number,
  ) {
    await expect
      .poll(() => vigilancia.exitosasDesde(marca, /PUT .*\/dashboards\//).length, { message: 'guardado del tablero' })
      .toBeGreaterThan(0);
  }

  const tarjetaDeWidget = (page: import('@playwright/test').Page, titulo: string) =>
    page.locator('fin-widget-card', { has: page.getByText(titulo, { exact: true }) }).first();

  async function valorDeFila(page: import('@playwright/test').Page, titulo: string, fila: string) {
    await tarjetaDeWidget(page, titulo).scrollIntoViewIfNeeded();
    const celdas = tarjetaDeWidget(page, titulo).locator('tbody tr', { hasText: fila }).first().locator('td');
    if (!(await celdas.count())) return NaN;
    return numeroDe((await celdas.last().textContent()) ?? '');
  }

  test('DAS-13 crear un widget por el creador lo muestra, sobrevive a recargar y queda en la API', async ({
    page,
    vigilancia,
  }) => {
    await personalizar(page);
    const titulo = `Gasto del periodo ${corrida}`;
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Crear widget' }).click();
    const formulario = dialogo(page);
    await formulario.getByRole('textbox', { name: 'Nombre' }).fill(titulo);
    await elegir(formulario, 'Otros widgets', 'Tabla');
    await elegir(formulario, 'Ancho del widget', 'Media pantalla');
    await formulario.getByRole('button', { name: 'Agregar widget' }).click();
    await expect(formulario).toBeHidden();
    await expect(tarjetaDeWidget(page, titulo)).toBeVisible();
    await esperarGuardado(page, vigilancia, marca);

    const delMes = await movimientosDelRango(page, rangoDe(hoy(), 'month'));
    const restaurantes = totalesDe(delMes.filter((m) => m.linkNames.category?.name === nombres.restaurantes)).gastos;
    expect(restaurantes).toBeGreaterThan(0);
    await expect.poll(() => valorDeFila(page, titulo, nombres.restaurantes)).toBe(restaurantes);

    const diseno = await disenoDelTablero(page, tableroId);
    const guardado = diseno.configs.find((c: { title?: string }) => c.title === titulo);
    expect(guardado, JSON.stringify(diseno.configs)).toBeTruthy();
    expect(guardado).toMatchObject({
      custom: true,
      type: 'table',
      wide: false,
      measure: 'expense',
      dimension: 'category',
    });

    await page.reload();
    await expect(page.locator('fin-kpi').first()).toBeVisible();
    await expect(tarjetaDeWidget(page, titulo)).toBeVisible();
    await expect.poll(() => valorDeFila(page, titulo, nombres.restaurantes)).toBe(restaurantes);
  });

  test('DAS-13 el creador exige nombre y se puede cancelar sin crear nada', async ({ page, vigilancia }) => {
    await personalizar(page);
    const antes = (await disenoDelTablero(page, tableroId)).configs.length;
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Crear widget' }).click();
    const formulario = dialogo(page);
    await formulario.getByRole('button', { name: 'Agregar widget' }).click();
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('textbox', { name: 'Nombre' })).toHaveAttribute('aria-invalid', 'true');
    await formulario.getByRole('textbox', { name: 'Nombre' }).fill('No debe existir');
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(tarjetaDeWidget(page, 'No debe existir')).toHaveCount(0);
    await page.waitForTimeout(1200);
    expect(vigilancia.exitosasDesde(marca, /PUT .*dashboards/)).toHaveLength(0);
    expect((await disenoDelTablero(page, tableroId)).configs).toHaveLength(antes);
  });

  const titulos = (page: import('@playwright/test').Page) => page.locator('fin-widget-card h2').allTextContents();

  test('DAS-14 mover un widget cambia el orden, persiste al recargar y queda en la API', async ({
    page,
    vigilancia,
  }) => {
    await personalizar(page);
    const antes = (await titulos(page)).map((x) => x.trim());
    expect(antes.length).toBeGreaterThan(3);
    const marca = vigilancia.marca();
    await tarjetaDeWidget(page, antes[0]).getByRole('button', { name: 'Mover abajo' }).click();
    await expect.poll(async () => (await titulos(page)).map((x) => x.trim()).slice(0, 2)).toEqual([antes[1], antes[0]]);
    await esperarGuardado(page, vigilancia, marca);
    const enApi = (await disenoDelTablero(page, tableroId)).widgets.map((w: { id: string }) => w.id);
    expect(enApi.slice(0, 2)).toEqual(['categories', 'flow']);

    await page.reload();
    await expect(page.locator('fin-kpi').first()).toBeVisible();
    await expect.poll(async () => (await titulos(page)).map((x) => x.trim()).slice(0, 2)).toEqual([antes[1], antes[0]]);

    await personalizar(page);
    const marcaDos = vigilancia.marca();
    await tarjetaDeWidget(page, antes[0]).getByRole('button', { name: 'Mover arriba' }).click();
    await expect.poll(async () => (await titulos(page)).map((x) => x.trim()).slice(0, 2)).toEqual([antes[0], antes[1]]);
    await esperarGuardado(page, vigilancia, marcaDos);
    expect((await disenoDelTablero(page, tableroId)).widgets.slice(0, 2).map((w: { id: string }) => w.id)).toEqual([
      'flow',
      'categories',
    ]);
  });

  test('DAS-14 cambiar el tipo de gráfica de un widget persiste al recargar y queda en la API', async ({
    page,
    vigilancia,
  }) => {
    await personalizar(page);
    const titulo = 'Ingresos en el tiempo';
    const tarjeta = tarjetaDeWidget(page, titulo);
    await tarjeta.scrollIntoViewIfNeeded();
    const marca = vigilancia.marca();
    await elegir(tarjeta, 'Tipo de visualización', 'Barras horizontales');
    await esperarGuardado(page, vigilancia, marca);
    const configs = (await disenoDelTablero(page, tableroId)).configs;
    expect(configs.find((c: { id: string }) => c.id === 'g-line')).toMatchObject({ id: 'g-line', type: 'barH' });

    await personalizar(page);
    const recargada = tarjetaDeWidget(page, titulo);
    await recargada.scrollIntoViewIfNeeded();
    await expect(recargada.locator('[data-slot=select-trigger][aria-label^="Tipo de visualización"]')).toContainText(
      'Barras horizontales',
    );
  });

  test('DAS-14 ocultar un widget y volver a mostrarlo persiste al recargar y queda en la API', async ({
    page,
    vigilancia,
  }) => {
    await personalizar(page);
    const titulo = 'Mapa de árbol de gastos';
    await tarjetaDeWidget(page, titulo).scrollIntoViewIfNeeded();
    const marca = vigilancia.marca();
    await tarjetaDeWidget(page, titulo).getByRole('button', { name: 'Ocultar' }).click();
    await expect(tarjetaDeWidget(page, titulo)).toHaveCount(0);
    await expect(page.locator('[data-slot=customize]').getByRole('button', { name: titulo })).toBeVisible();
    await esperarGuardado(page, vigilancia, marca);
    expect((await disenoDelTablero(page, tableroId)).hidden).toContain('g-treemap');

    await abrirTablero(page, ruta());
    await expect(page.locator('fin-widget-card h2', { hasText: 'Cascada del saldo neto' })).toHaveCount(1);
    await expect(page.locator('fin-widget-card h2', { hasText: titulo })).toHaveCount(0);

    await personalizar(page);
    const marcaDos = vigilancia.marca();
    await page.locator('[data-slot=customize]').getByRole('button', { name: titulo }).click();
    await expect(tarjetaDeWidget(page, titulo)).toHaveCount(1);
    await esperarGuardado(page, vigilancia, marcaDos);
    expect((await disenoDelTablero(page, tableroId)).hidden ?? []).not.toContain('g-treemap');
    await abrirTablero(page, ruta());
    await expect(page.locator('fin-widget-card h2', { hasText: titulo })).toHaveCount(1);
  });

  test('DAS-14 editar la dimensión y la métrica de un widget persiste al recargar y queda en la API', async ({
    page,
    vigilancia,
  }) => {
    await personalizar(page);
    const titulo = 'Movimientos por categoría';
    const tarjeta = tarjetaDeWidget(page, titulo);
    await tarjeta.scrollIntoViewIfNeeded();
    const marca = vigilancia.marca();
    await elegir(tarjeta, 'Dimensión', 'Cuenta o tarjeta');
    await elegir(tarjeta, 'Métrica', /^Gasto$/);
    await esperarGuardado(page, vigilancia, marca);
    await expect
      .poll(async () =>
        (await disenoDelTablero(page, tableroId)).configs.find((c: { id: string }) => c.id === 'g-barh'),
      )
      .toMatchObject({ dimension: 'account', measure: 'expense' });

    await personalizar(page);
    const recargada = tarjetaDeWidget(page, titulo);
    await recargada.scrollIntoViewIfNeeded();
    await expect(recargada.locator('[data-slot=select-trigger][aria-label^="Dimensión"]')).toContainText(
      'Cuenta o tarjeta',
    );
    await expect(recargada.locator('[data-slot=select-trigger][aria-label^="Métrica"]')).toContainText('Gasto');
  });

  test('DAS-14 los cambios del tablero principal viajan al servidor y los ve una sesión limpia', async ({
    page,
    browser,
    vigilancia,
  }) => {
    await abrirTablero(page);
    await page.getByRole('button', { name: 'Personalizar' }).click();
    try {
      const marca = vigilancia.marca();
      await page
        .locator('fin-widget-card', { has: page.getByRole('heading', { name: 'Evolución del gasto' }) })
        .getByRole('button', { name: 'Ocultar' })
        .click();
      await expect(page.locator('fin-widget-card h2', { hasText: 'Evolución del gasto' })).toHaveCount(0);
      await expect
        .poll(() => vigilancia.exitosasDesde(marca, /PUT .*preferences\/dashboard-layout/).length)
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () =>
            JSON.parse(
              (await (await page.request.get(`${apiUrl}/api/v1/preferences`)).json()).dashboardLayoutJson ?? '{}',
            ).hidden,
        )
        .toContain('trend');

      const limpio = await contextoCon(browser, estadoPropietario);
      try {
        const otra = await limpio.newPage();
        await abrirTablero(otra);
        await expect(otra.locator('fin-widget-card h2', { hasText: 'Gastos por categoría' })).toHaveCount(1);
        await expect(otra.locator('fin-widget-card h2', { hasText: 'Evolución del gasto' })).toHaveCount(0);
        await otra.close();
      } finally {
        await limpio.close();
      }
    } finally {
      const marcaRestablecer = vigilancia.marca();
      await page.getByRole('button', { name: 'Restablecer diseño' }).click();
      await expect
        .poll(() => vigilancia.exitosasDesde(marcaRestablecer, /PUT .*preferences\/dashboard-layout/).length)
        .toBeGreaterThan(0);
      await expect
        .poll(async () => (await (await page.request.get(`${apiUrl}/api/v1/preferences`)).json()).dashboardLayoutJson)
        .toBeNull();
      await expect(page.locator('fin-widget-card h2', { hasText: 'Evolución del gasto' })).toHaveCount(1);
    }
  });
});

test.describe('Tablero: indicadores propios con fórmula', () => {
  let tableroId = '';

  test.beforeAll(async () => {
    const api = await iniciarApi();
    tableroId = (await api.exigir('POST', '/api/v1/dashboards', { name: `E2E indicadores ${corrida}` })).id;
  });

  const ruta = () => `dashboard?tablero=${tableroId}`;

  test('DAS-15 un indicador propio con filtro y fórmula muestra el valor correcto, persiste y se puede borrar', async ({
    page,
    vigilancia,
  }) => {
    const etiqueta = `Restaurantes por día ${corrida}`;
    const etiquetaDos = `Gasto en restaurantes ${corrida}`;
    const mes = rangoDe(hoy(), 'month');
    const delMes = await movimientosDelRango(page, mes);
    const restaurantes = totalesDe(delMes.filter((m) => m.linkNames.category?.name === nombres.restaurantes)).gastos;
    expect(restaurantes).toBeGreaterThan(0);
    const dias =
      Math.round((Date.parse(`${mes.end}T12:00:00Z`) - Date.parse(`${mes.start}T12:00:00Z`)) / 86_400_000) + 1;

    await abrirTablero(page, ruta());
    await page.getByRole('button', { name: 'Personalizar' }).click();
    const crearIndicador = async (nombre: string, metrica: string | RegExp) => {
      await page.locator('[data-slot=customize]').getByRole('button', { name: 'Crear indicador' }).click();
      const formulario = dialogo(page);
      await formulario.getByRole('textbox', { name: 'Nombre' }).fill(nombre);
      await elegir(formulario, 'Medir solo sobre', 'Categoría');
      await elegir(formulario, 'Valor', nombres.restaurantes);
      await elegir(formulario, 'Métrica del indicador', metrica);
      const marca = vigilancia.marca();
      await formulario.getByRole('button', { name: 'Agregar indicador' }).click();
      await expect(formulario).toBeHidden();
      await expect.poll(() => vigilancia.exitosasDesde(marca, /PUT .*\/dashboards\//).length).toBeGreaterThan(0);
    };

    await crearIndicador(etiqueta, 'Gasto promedio diario');
    await expect.poll(() => numeroDeKpi(page, etiqueta)).toBeCloseTo(restaurantes / dias, 0);
    await crearIndicador(etiquetaDos, /^Gasto$/);
    await expect.poll(() => numeroDeKpi(page, etiquetaDos)).toBe(restaurantes);

    const definiciones = (await disenoDelTablero(page, tableroId)).definitions;
    expect(definiciones.find((d: { label: string }) => d.label === etiqueta)).toMatchObject({
      formula: 'dailyExpense',
      filter: { dimension: 'category', value: nombres.restaurantes },
    });
    expect(definiciones.find((d: { label: string }) => d.label === etiquetaDos)).toMatchObject({
      formula: 'expense',
      filter: { dimension: 'category', value: nombres.restaurantes },
    });

    await abrirTablero(page, ruta());
    await expect.poll(() => numeroDeKpi(page, etiquetaDos)).toBe(restaurantes);
    expect(await kpisRecortados(page)).toEqual([]);

    await page.getByRole('button', { name: 'Personalizar' }).click();
    const marcaBorrado = vigilancia.marca();
    await etiquetaDeKpi(page, etiquetaDos)
      .locator('xpath=ancestor::fin-flow-item[1]')
      .getByRole('button', { name: 'Quitar indicador' })
      .click();
    await expect(etiquetaDeKpi(page, etiquetaDos)).toHaveCount(0);
    await expect.poll(() => vigilancia.exitosasDesde(marcaBorrado, /PUT .*\/dashboards\//).length).toBeGreaterThan(0);
    const restantes = (await disenoDelTablero(page, tableroId)).definitions.map((d: { label: string }) => d.label);
    expect(restantes).not.toContain(etiquetaDos);
    expect(restantes).toContain(etiqueta);
    await abrirTablero(page, ruta());
    await expect(etiquetaDeKpi(page, etiquetaDos)).toHaveCount(0);
    await expect(etiquetaDeKpi(page, etiqueta)).toBeVisible();
  });

  test('DAS-15 no se puede crear un indicador sin nombre ni con un filtro sin valor', async ({ page, vigilancia }) => {
    await abrirTablero(page, ruta());
    await page.getByRole('button', { name: 'Personalizar' }).click();
    const antes = (await disenoDelTablero(page, tableroId)).definitions.length;
    const marca = vigilancia.marca();
    await page.locator('[data-slot=customize]').getByRole('button', { name: 'Crear indicador' }).click();
    const formulario = dialogo(page);
    await formulario.getByRole('button', { name: 'Agregar indicador' }).click();
    await expect(formulario).toBeVisible();
    await formulario.getByRole('textbox', { name: 'Nombre' }).fill('Sin valor de filtro');
    await elegir(formulario, 'Medir solo sobre', 'Categoría');
    await formulario.getByRole('button', { name: 'Agregar indicador' }).click();
    await expect(formulario).toBeVisible();
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(etiquetaDeKpi(page, 'Sin valor de filtro')).toHaveCount(0);
    await page.waitForTimeout(1200);
    expect(vigilancia.exitosasDesde(marca, /PUT .*dashboards/)).toHaveLength(0);
    expect((await disenoDelTablero(page, tableroId)).definitions).toHaveLength(antes);
  });
});

test.describe('Tablero: varios tableros', () => {
  let tableroId = '';
  const nombreInicial = `E2E enlace ${corrida}`;

  test.beforeAll(async () => {
    const api = await iniciarApi();
    tableroId = (await api.exigir('POST', '/api/v1/dashboards', { name: nombreInicial })).id;
  });

  test('DAS-16 abrir el enlace de un tablero lo muestra sin perder el parámetro de la URL ni navegar de más', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const registro: string[] = [];
      (window as unknown as { __navegaciones: string[] }).__navegaciones = registro;
      const reemplazar = history.replaceState.bind(history);
      history.replaceState = (estado, titulo, url) => {
        registro.push(String(url));
        return reemplazar(estado, titulo, url);
      };
    });
    await abrirTablero(page, `dashboard?tablero=${tableroId}`);
    await expect(page.getByRole('combobox', { name: /^Tablero/ })).toContainText(nombreInicial);
    await page.waitForTimeout(1500);
    const navegaciones = await page.evaluate(() => (window as unknown as { __navegaciones: string[] }).__navegaciones);
    expect(navegaciones.filter((url) => !url.includes(`tablero=${tableroId}`))).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`tablero=${tableroId}`));
  });

  const nombreA = `E2E tablero A ${corrida}`;
  const nombreRenombrado = `E2E tablero renombrado ${corrida}`;
  const nombreB = `E2E tablero B ${corrida}`;
  let idA = '';

  const selector = (page: import('@playwright/test').Page) => page.getByRole('combobox', { name: /^Tablero/ });
  const guardarPanel = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const encabezados = (page: import('@playwright/test').Page) => page.locator('fin-widget-card h2');

  test('DAS-16 crear un tablero por la UI lo deja en la API, abierto y con la URL propia', async ({
    page,
    vigilancia,
  }) => {
    await abrirTablero(page);
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Nuevo tablero' }).click();
    await page.getByRole('textbox', { name: 'Nombre del tablero' }).fill(nombreA);
    await guardarPanel(page);
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*\/dashboards$/).length).toBeGreaterThan(0);
    await expect(selector(page)).toContainText(nombreA);
    const creado = (await tablerosDelUsuario(page)).find((x) => x.name === nombreA);
    expect(creado).toMatchObject({ isMine: true, isPinned: false, sharedWith: [] });
    idA = creado.id;
    await expect(page).toHaveURL(new RegExp(`tablero=${idA}`));
    await page.reload();
    await expect(selector(page)).toContainText(nombreA);
  });

  test('DAS-16 el nombre del tablero es obligatorio: el API lo rechaza y la pantalla lo avisa', async ({
    page,
    vigilancia,
  }) => {
    await abrirTablero(page);
    const antes = (await tablerosDelUsuario(page)).length;
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Nuevo tablero' }).click();
    await page.getByRole('textbox', { name: 'Nombre del tablero' }).fill('    ');
    await guardarPanel(page);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nombre del tablero' })).toBeVisible();
    const envios = vigilancia
      .escriturasDesde(marca)
      .filter((e) => /POST .*\/dashboards$/.test(`${e.metodo} ${e.ruta}`));
    expect(envios.length).toBeGreaterThan(0);
    expect(envios.every((e) => e.estado === 400)).toBe(true);
    expect(await tablerosDelUsuario(page)).toHaveLength(antes);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nombre del tablero' })).toHaveCount(0);
    vigilancia.aceptarErroresEsperados();
  });

  test('DAS-16 cada tablero conserva su propio diseño al cambiar entre ellos y al recargar', async ({
    page,
    vigilancia,
  }) => {
    await abrirTablero(page, `dashboard?tablero=${idA}`);
    await page.getByRole('button', { name: 'Personalizar' }).click();
    const marca = vigilancia.marca();
    await page
      .locator('fin-widget-card', { has: page.getByRole('heading', { name: 'Flujo de caja' }) })
      .getByRole('button', { name: 'Ocultar' })
      .click();
    await expect(encabezados(page).filter({ hasText: 'Flujo de caja' })).toHaveCount(0);
    await expect.poll(() => vigilancia.exitosasDesde(marca, /PUT .*\/dashboards\//).length).toBeGreaterThan(0);
    expect((await disenoDelTablero(page, idA)).hidden).toContain('flow');

    await elegir(page.locator('body'), 'Tablero', 'Principal');
    await expect(page).not.toHaveURL(/tablero=/);
    await expect(encabezados(page).filter({ hasText: 'Flujo de caja' })).toHaveCount(1);

    await elegir(page.locator('body'), 'Tablero', nombreA);
    await expect(page).toHaveURL(new RegExp(`tablero=${idA}`));
    await expect(encabezados(page).filter({ hasText: 'Flujo de caja' })).toHaveCount(0);

    await page.reload();
    await expect(page.locator('fin-kpi').first()).toBeVisible();
    await expect(selector(page)).toContainText(nombreA);
    await expect(encabezados(page).filter({ hasText: 'Flujo de caja' })).toHaveCount(0);
    await expect(encabezados(page).filter({ hasText: 'Gastos por categoría' })).toHaveCount(1);
  });

  test('DAS-16 renombrar y fijar un tablero se guarda en la API y sobrevive a recargar', async ({
    page,
    vigilancia,
  }) => {
    await abrirTablero(page, `dashboard?tablero=${idA}`);
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Renombrar' }).click();
    await expect(page.getByRole('textbox', { name: 'Nombre del tablero' })).toHaveValue(nombreA);
    await page.getByRole('textbox', { name: 'Nombre del tablero' }).fill(nombreRenombrado);
    await guardarPanel(page);
    await expect.poll(() => vigilancia.exitosasDesde(marca, /PUT .*\/dashboards\//).length).toBeGreaterThan(0);
    await expect(selector(page)).toContainText(nombreRenombrado);
    const renombrado = await leerTablero(page, idA);
    expect(renombrado.name).toBe(nombreRenombrado);
    expect(JSON.parse(renombrado.layoutJson).hidden).toContain('flow');

    const marcaFijar = vigilancia.marca();
    await page.getByRole('button', { name: 'Fijar en el menú' }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marcaFijar, /PUT .*\/dashboards\//).length).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Quitar del menú' })).toHaveAttribute('aria-pressed', 'true');
    expect((await leerTablero(page, idA)).isPinned).toBe(true);

    await page.reload();
    await expect(selector(page)).toContainText(nombreRenombrado);
    await expect(page.getByRole('button', { name: 'Quitar del menú' })).toBeVisible();
  });

  test('DAS-16 un tablero nuevo puede partir del diseño del actual y se borra con confirmación', async ({
    page,
    vigilancia,
  }) => {
    await abrirTablero(page, `dashboard?tablero=${idA}`);
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Nuevo tablero' }).click();
    await page.getByRole('textbox', { name: 'Nombre del tablero' }).fill(nombreB);
    await guardarPanel(page);
    await expect.poll(() => vigilancia.exitosasDesde(marca, /POST .*\/dashboards$/).length).toBeGreaterThan(0);
    await expect(selector(page)).toContainText(nombreB);
    const b = (await tablerosDelUsuario(page)).find((x) => x.name === nombreB);
    expect(JSON.parse((await leerTablero(page, b.id)).layoutJson).hidden).toContain('flow');
    await expect(encabezados(page).filter({ hasText: 'Flujo de caja' })).toHaveCount(0);

    const marcaBorrado = vigilancia.marca();
    await page.getByRole('button', { name: 'Borrar tablero' }).click();
    await expect(page.getByRole('alertdialog')).toContainText(nombreB);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
    expect((await tablerosDelUsuario(page)).some((x) => x.id === b.id)).toBe(true);

    await page.getByRole('button', { name: 'Borrar tablero' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar tablero' }).click();
    await expect
      .poll(() => vigilancia.exitosasDesde(marcaBorrado, /DELETE .*\/dashboards\//).length)
      .toBeGreaterThan(0);
    await expect(selector(page)).toContainText('Principal');
    await expect(page).not.toHaveURL(/tablero=/);
    expect((await tablerosDelUsuario(page)).some((x) => x.id === b.id)).toBe(false);
    expect((await tablerosDelUsuario(page)).some((x) => x.id === idA)).toBe(true);
    const ausente = await page.request.get(`${apiUrl}/api/v1/dashboards/${b.id}`);
    expect(ausente.status()).toBe(404);
    vigilancia.aceptarErroresEsperados();

    await page.reload();
    await expect(selector(page)).toContainText('Principal');
  });

  test('DAS-16 al llegar al máximo de tableros el API rechaza otro y la pantalla muestra el motivo', async ({
    page,
    vigilancia,
  }) => {
    const api = await iniciarApi();
    const existentes = (await api.exigir('GET', '/api/v1/dashboards')) as { id: string }[];
    const rellenos: string[] = [];
    for (let i = existentes.length; i < 20; i += 1)
      rellenos.push((await api.exigir('POST', '/api/v1/dashboards', { name: `E2E relleno ${i} ${corrida}` })).id);
    try {
      expect(await tablerosDelUsuario(page)).toHaveLength(20);
      await abrirTablero(page);
      const marca = vigilancia.marca();
      await page.getByRole('button', { name: 'Nuevo tablero' }).click();
      await page.getByRole('textbox', { name: 'Nombre del tablero' }).fill(`E2E exceso ${corrida}`);
      await guardarPanel(page);
      await expect(page.getByRole('alert').filter({ hasText: /hasta 20 tableros/ })).toBeVisible();
      expect(vigilancia.escriturasDesde(marca).map((e) => e.estado)).toContain(400);
      expect(await tablerosDelUsuario(page)).toHaveLength(20);
      vigilancia.aceptarErroresEsperados();
    } finally {
      for (const id of rellenos) await api.llamar('DELETE', `/api/v1/dashboards/${id}`);
    }
  });
});

test.describe('Tablero: compartir y permisos del lector', () => {
  test.skip(
    !credencialesLector(),
    'Define E2E_VIEWER_USER y E2E_VIEWER_PASSWORD para probar la cuenta de solo lectura.',
  );

  let tableroId = '';
  let lectorId = '';
  const nombre = `E2E compartido ${corrida}`;
  const ocultoPorElDueno = 'flow';

  test.beforeAll(async () => {
    const api = await iniciarApi();
    tableroId = (
      await api.exigir('POST', '/api/v1/dashboards', {
        name: nombre,
        layoutJson: JSON.stringify({ version: 2, widgets: [], kpis: [], hidden: [ocultoPorElDueno] }),
      })
    ).id;
    const miembros = (await api.exigir('GET', '/api/v1/dashboards/members')) as { id: string; email: string }[];
    lectorId = miembros.find((m) => m.email === 'e2e-lector@finanzas.test')?.id ?? '';
    expect(lectorId).not.toBe('');
  });

  test('DAS-17 el dueño comparte un tablero con el lector desde la pantalla y queda en la API', async ({
    page,
    vigilancia,
  }) => {
    await abrirTablero(page, `dashboard?tablero=${tableroId}`);
    expect((await leerTablero(page, tableroId)).sharedWith).toEqual([]);
    await page.getByRole('button', { name: 'Compartir', exact: true }).click();
    const lector = page.getByRole('checkbox', { name: /Lector E2E/ });
    await expect(lector).not.toBeChecked();
    await lector.click();
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /PUT .*\/shares$/).length).toBeGreaterThan(0);
    const compartido = await leerTablero(page, tableroId);
    expect(compartido.sharedWith.map((x: { id: string }) => x.id)).toEqual([lectorId]);
    await page.reload();
    await expect(page.getByRole('combobox', { name: /^Tablero/ })).toContainText(nombre);
    await page.getByRole('combobox', { name: /^Tablero/ }).click();
    await expect(page.getByRole('option', { name: new RegExp(nombre) })).toContainText('Compartido con 1');
    await page.keyboard.press('Escape');
  });

  test('DAS-17 el lector ve el tablero en «compartidos conmigo», sin poder editarlo, y el API se lo rechaza', async ({
    browser,
  }) => {
    const contexto = await contextoDelLector(browser);
    try {
      const page = await contexto.newPage();
      await abrirTablero(page);
      await expect(page.getByRole('button', { name: 'Nuevo tablero' })).toHaveCount(0);
      await page.getByRole('combobox', { name: /^Tablero/ }).click();
      const opcion = page.getByRole('option', { name: new RegExp(nombre) });
      await expect(opcion).toContainText('Compartido por Propietario E2E');
      await opcion.click();
      await expect(page).toHaveURL(new RegExp(`tablero=${tableroId}`));
      await expect(page.getByText('Solo lectura · de Propietario E2E')).toBeVisible();
      for (const boton of [
        'Nuevo tablero',
        'Renombrar',
        'Compartir',
        'Borrar tablero',
        'Fijar en el menú',
        'Personalizar',
      ])
        await expect(page.getByRole('button', { name: boton, exact: true }), `botón «${boton}»`).toHaveCount(0);
      await expect(page.locator('fin-widget-card h2', { hasText: 'Flujo de caja' })).toHaveCount(0);
      await expect(page.locator('fin-widget-card h2', { hasText: 'Gastos por categoría' })).toHaveCount(1);

      const lectura = await page.request.get(`${apiUrl}/api/v1/dashboards/${tableroId}`);
      expect(lectura.status()).toBe(200);
      expect((await lectura.json()).isMine).toBe(false);

      const antes = await tableroDeLaApi(tableroId);
      const edicion = await escribirComo(page, 'PUT', `/api/v1/dashboards/${tableroId}`, {
        name: 'Secuestrado',
        layoutJson: null,
        isPinned: true,
      });
      expect([403, 404], `PUT: ${JSON.stringify(edicion.cuerpo)}`).toContain(edicion.estado);
      const borrado = await escribirComo(page, 'DELETE', `/api/v1/dashboards/${tableroId}`);
      expect(borrado.estado, `DELETE: ${JSON.stringify(borrado.cuerpo)}`).toBe(403);
      const reparto = await escribirComo(page, 'PUT', `/api/v1/dashboards/${tableroId}/shares`, { users: [lectorId] });
      expect(reparto.estado, `shares: ${JSON.stringify(reparto.cuerpo)}`).toBe(403);
      const creacion = await escribirComo(page, 'POST', '/api/v1/dashboards', { name: 'No debe existir' });
      expect(creacion.estado, `POST: ${JSON.stringify(creacion.cuerpo)}`).toBe(403);
      for (const rechazo of [edicion, borrado, reparto, creacion])
        expect(JSON.stringify(rechazo.cuerpo)).not.toMatch(/csrf/i);
      expect(await tableroDeLaApi(tableroId)).toEqual(antes);
      expect((await tablerosDelUsuario(page)).some((x) => x.name === 'No debe existir')).toBe(false);
    } finally {
      await contexto.close();
    }
  });

  test('DAS-17 dejar de compartir quita el tablero al lector', async ({ page, browser, vigilancia }) => {
    await abrirTablero(page, `dashboard?tablero=${tableroId}`);
    await page.getByRole('button', { name: 'Compartir', exact: true }).click();
    const lector = page.getByRole('checkbox', { name: /Lector E2E/ });
    await expect(lector).toBeChecked();
    await lector.click();
    const marca = vigilancia.marca();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => vigilancia.exitosasDesde(marca, /PUT .*\/shares$/).length).toBeGreaterThan(0);
    expect((await leerTablero(page, tableroId)).sharedWith).toEqual([]);

    const contexto = await contextoDelLector(browser);
    try {
      const paginaLector = await contexto.newPage();
      await abrirTablero(paginaLector);
      await paginaLector.getByRole('combobox', { name: /^Tablero/ }).click();
      await expect(paginaLector.getByRole('option', { name: new RegExp(nombre) })).toHaveCount(0);
      await paginaLector.keyboard.press('Escape');
      const ausente = await paginaLector.request.get(`${apiUrl}/api/v1/dashboards/${tableroId}`);
      expect(ausente.status()).toBe(404);
      await abrirTablero(paginaLector, `dashboard?tablero=${tableroId}`);
      await expect(paginaLector.getByRole('combobox', { name: /^Tablero/ })).toContainText('Principal');
      await paginaLector.close();
    } finally {
      await contexto.close();
    }
    vigilancia.aceptarErroresEsperados();
  });

  async function tableroDeLaApi(id: string) {
    const api = await iniciarApi();
    const { updatedAt, ...resto } = await api.exigir('GET', `/api/v1/dashboards/${id}`);
    void updatedAt;
    return resto;
  }
});

test.describe('Tablero: piezas según el permiso del rol', () => {
  test.skip(
    !credencialesLector(),
    'Define E2E_VIEWER_USER y E2E_VIEWER_PASSWORD para probar la cuenta de solo lectura.',
  );

  const soloAvanzados = ['Movimiento neto por cuenta', 'Gasto promedio por categoría'];
  const titulosDe = (page: import('@playwright/test').Page) => page.locator('fin-widget-card h2').allTextContents();

  test('DAS-18 el dueño ve todos los widgets y el lector solo los que su rol permite', async ({ page, browser }) => {
    await abrirTablero(page);
    await expect.poll(async () => (await titulosDe(page)).length).toBeGreaterThan(5);
    const delDueno = (await titulosDe(page)).map((x) => x.trim());
    for (const titulo of soloAvanzados) expect(delDueno).toContain(titulo);
    await expect(page.getByRole('button', { name: 'Personalizar' })).toBeVisible();

    const sesion = await (await page.request.get(`${apiUrl}/api/v1/session`)).json();
    expect(sesion.permissions).toEqual(
      expect.arrayContaining(['dashboard.widget.compromisos.ver', 'dashboard.widget.salud.ver']),
    );

    const contexto = await contextoDelLector(browser);
    try {
      const paginaLector = await contexto.newPage();
      await abrirTablero(paginaLector);
      await expect.poll(async () => (await titulosDe(paginaLector)).length).toBeGreaterThan(5);
      const permisos: string[] = (await (await paginaLector.request.get(`${apiUrl}/api/v1/session`)).json())
        .permissions;
      expect(permisos).not.toContain('dashboard.widget.compromisos.ver');
      expect(permisos).not.toContain('dashboard.widget.salud.ver');
      expect(permisos).toEqual(expect.arrayContaining(['dashboard.widget.flujo.ver', 'dashboard.tabla.ver']));
      const delLector = (await titulosDe(paginaLector)).map((x) => x.trim());
      expect(delLector).toEqual(delDueno.filter((titulo) => !soloAvanzados.includes(titulo)));
      for (const titulo of soloAvanzados) expect(delLector).not.toContain(titulo);

      await expect(paginaLector.getByRole('button', { name: 'Personalizar' })).toHaveCount(0);
      await expect(paginaLector.getByRole('button', { name: 'Crear widget' })).toHaveCount(0);
      await expect(paginaLector.locator('[data-slot=solo-lectura]')).toBeVisible();
      for (const kpi of ['Balance del periodo', 'Ingresos', 'Gastos', 'Movimientos'])
        await expect(etiquetaDeKpi(paginaLector, kpi)).toBeVisible();

      const rango = rangoDe(hoy(), 'month');
      const esperado = totalesDe(await movimientosDelRango(paginaLector, rango));
      await expect.poll(() => numeroDeKpi(paginaLector, 'Gastos')).toBe(esperado.gastos);
      await expect.poll(() => numeroDeKpi(paginaLector, 'Ingresos')).toBe(esperado.ingresos);
      await paginaLector.close();
    } finally {
      await contexto.close();
    }
  });
});

test.describe('Tablero: tabla «Movimientos del periodo»', () => {
  const categoriaTabla = `E2E Tabla ${corrida}`;
  const total = 18;
  const descripcionDe = (n: number) => `E2E tabla ${String(n).padStart(2, '0')} ${corrida}`;
  const importeDe = (n: number) => n * 1000;
  const fechaDe = (n: number) => sumarDias(hoy(), -(n % 9));

  test.beforeAll(async () => {
    const api = await iniciarApi();
    const id = await crearCategoria(api, categoriaTabla);
    for (let n = 1; n <= total; n += 1)
      await sembrarGasto(api, `tabla-${n}`, fechaDe(n), importeDe(n), id, descripcionDe(n));
  });

  async function prepararTabla(page: import('@playwright/test').Page) {
    await abrirTablero(page);
    await elegirEscala(page, 'Año');
    await aplicarFiltro(page, 'categoria', categoriaTabla);
    await expect.poll(() => numeroDeKpi(page, 'Movimientos')).toBe(total);
    return contenedorDeTabla(page);
  }

  const rangoDeFilas = (tabla: import('@playwright/test').Locator) => tabla.locator('footer span[aria-live=polite]');
  const celdasDe = (tabla: import('@playwright/test').Locator, columna: number) =>
    tabla
      .locator('tbody tr')
      .evaluateAll(
        (filas, indice) => filas.map((fila) => (fila.querySelectorAll('td')[indice]?.textContent ?? '').trim()),
        columna,
      );

  test('DAS-19 la tabla pagina de 15 en 15 y muestra todas las filas del periodo', async ({ page }) => {
    const tabla = await prepararTabla(page);
    await expect(rangoDeFilas(tabla)).toContainText(`1–15 de ${total}`);
    await expect(tabla.locator('tbody tr')).toHaveCount(15);
    await expect(tabla.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await tabla.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(rangoDeFilas(tabla)).toContainText(`16–${total} de ${total}`);
    await expect(tabla.locator('tbody tr')).toHaveCount(total - 15);
    await expect(tabla.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    const vistas = [...(await celdasDe(tabla, 1))];
    await tabla.getByRole('button', { name: 'Primera página' }).click();
    await expect(rangoDeFilas(tabla)).toContainText(`1–15 de ${total}`);
    const primeras = await celdasDe(tabla, 1);
    expect([...primeras, ...vistas].sort()).toEqual(
      Array.from({ length: total }, (_, i) => descripcionDe(i + 1)).sort(),
    );
  });

  test('DAS-19 buscar filtra las filas y una búsqueda sin resultados lo dice', async ({ page }) => {
    const tabla = await prepararTabla(page);
    const buscador = tabla
      .getByRole('searchbox')
      .or(tabla.getByPlaceholder(/Buscar/))
      .first();
    await buscador.fill(`tabla 07 ${corrida}`);
    await expect(tabla.locator('tbody tr')).toHaveCount(1);
    await expect(tabla.locator('tbody tr')).toContainText(descripcionDe(7));
    await expect(rangoDeFilas(tabla)).toContainText('1–1 de 1');
    await buscador.fill('no existe ninguna fila así');
    await expect(tabla.locator('tbody')).toContainText('Ningún resultado coincide con los filtros.');
    await buscador.fill('');
    await expect(rangoDeFilas(tabla)).toContainText(`1–15 de ${total}`);
  });

  test('DAS-19 ordenar por importe y por fecha reordena la tabla en ambos sentidos', async ({ page }) => {
    const tabla = await prepararTabla(page);
    await tabla.getByRole('button', { name: 'Ordenar por Importe' }).click();
    const primero = await celdasDe(tabla, 4);
    await tabla.getByRole('button', { name: 'Ordenar por Importe' }).click();
    const segundo = await celdasDe(tabla, 4);
    const valores = (lista: string[]) => lista.map(numeroDe);
    const sentido = (lista: number[]) =>
      lista.every((v, i) => i === 0 || v >= lista[i - 1])
        ? 'asc'
        : lista.every((v, i) => i === 0 || v <= lista[i - 1])
          ? 'desc'
          : 'sin orden numérico';
    const sentidos = [sentido(valores(primero)), sentido(valores(segundo))];
    expect(sentidos.slice().sort(), `importes: ${primero.join(' | ')} / ${segundo.join(' | ')}`).toEqual([
      'asc',
      'desc',
    ]);
    const extremos = [valores(primero)[0], valores(segundo)[0]].sort((a, b) => a - b);
    expect(extremos, 'el orden es de todo el periodo, no solo de la página visible').toEqual([
      -importeDe(total),
      -importeDe(1),
    ]);

    await tabla.getByRole('button', { name: 'Ordenar por Fecha' }).click();
    const fechas = await celdasDe(tabla, 0);
    expect(fechas).toEqual([...fechas].sort());
    expect(fechas[0]).toBe(sumarDias(hoy(), -8));
    await tabla.getByRole('button', { name: 'Ordenar por Fecha' }).click();
    const alReves = await celdasDe(tabla, 0);
    expect(alReves).toEqual([...alReves].sort().reverse());
    expect(alReves[0]).toBe(hoy());
  });

  test('DAS-19 al abrir una fila el detalle muestra los datos del movimiento y enlaza a Movimientos', async ({
    page,
  }) => {
    const tabla = await prepararTabla(page);
    const n = 12;
    await tabla
      .getByRole('searchbox')
      .or(tabla.getByPlaceholder(/Buscar/))
      .first()
      .fill(descripcionDe(n));
    await expect(tabla.locator('tbody tr')).toHaveCount(1);
    await tabla.locator('tbody tr td').nth(1).click();
    const detalle = panelLateral(page);
    await expect(detalle).toContainText(descripcionDe(n));
    await expect(detalle.locator('strong').first()).toContainText(importeDe(n).toLocaleString('es-CO'));
    await expect(detalle).toContainText(fechaDe(n));
    await expect(detalle).toContainText(categoriaTabla);
    await expect(detalle).toContainText(nombres.ahorros);
    await expect(detalle).toContainText('Confirmado');

    const [delApi] = (await movimientosDelRango(page, rangoDe(hoy(), 'year'))).filter(
      (m) => m.description === descripcionDe(n),
    );
    expect(Number(delApi.amount.base.amount)).toBe(importeDe(n));
    expect(delApi.date).toBe(fechaDe(n));

    await detalle.getByRole('link', { name: 'Abrir en Movimientos' }).click();
    await expect(page).toHaveURL(/\/movements/);
  });

  test('DAS-19 «Ver todos» lleva a Movimientos', async ({ page }) => {
    await abrirTablero(page);
    await contenedorDeTabla(page)
      .getByRole('link', { name: /Ver todos/ })
      .click();
    await expect(page).toHaveURL(/\/movements/);
    await expect(page.getByRole('button', { name: /Nuevo movimiento/ }).first()).toBeVisible();
  });

  test.fixme('DAS-19 «Ver todos» conserva el periodo y los filtros del tablero', async ({ page }) => {
    await prepararTabla(page);
    await contenedorDeTabla(page)
      .getByRole('link', { name: /Ver todos/ })
      .click();
    await expect(page).toHaveURL(/categoria=|cuenta=|desde=/);
  });
});

test.describe('Tablero: Resumen y Explorar', () => {
  test('DAS-20 cambiar entre Resumen y Explorar conserva periodo y filtros y la URL se respeta al recargar', async ({
    page,
  }) => {
    await abrirTablero(page);
    await elegirEscala(page, 'Año');
    await aplicarFiltro(page, 'categoria', nombres.restaurantes);
    const rango = rangoDe(hoy(), 'year');
    const delAnio = (await movimientosDelRango(page, rango)).filter(
      (m) => m.linkNames.category?.name === nombres.restaurantes,
    );
    const esperado = totalesDe(delAnio);
    expect(esperado.gastos).toBeGreaterThan(0);
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(esperado.gastos);

    await page.getByRole('button', { name: 'Resumen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resumen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/vista=resumen/);
    await expect(page).toHaveURL(/escala=year/);
    await expect(page).toHaveURL(/categoria=/);
    await expect(page.getByRole('button', { name: 'Personalizar' })).toHaveCount(0);
    await expect.poll(() => valorDeKpiDeResumen(page, 'Gastos')).toBe(esperado.gastos);
    await expect(escalaDelPanel(page, 'Año')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Filtrar por categoría/ })).toContainText(nombres.restaurantes);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Resumen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => valorDeKpiDeResumen(page, 'Gastos')).toBe(esperado.gastos);
    await expect(escalaDelPanel(page, 'Año')).toHaveAttribute('aria-pressed', 'true');

    const anterior = rangoDe(desplazar(hoy(), 'year', -1), 'year');
    await page.getByRole('button', { name: 'Periodo anterior' }).click();
    const delAnterior = totalesDe(
      (await movimientosDelRango(page, anterior)).filter((m) => m.linkNames.category?.name === nombres.restaurantes),
    );
    await expect.poll(() => valorDeKpiDeResumen(page, 'Gastos')).toBe(delAnterior.gastos);

    await page.getByRole('button', { name: 'Explorar', exact: true }).click();
    await expect(page).not.toHaveURL(/vista=/);
    await expect(page).toHaveURL(/escala=year/);
    await expect(page.getByRole('button', { name: 'Personalizar' })).toBeVisible();
    await expect.poll(() => numeroDeKpi(page, 'Gastos')).toBe(delAnterior.gastos);
    await expect(page.getByRole('button', { name: /^Filtrar por categoría/ })).toContainText(nombres.restaurantes);

    await page.goto('/dashboard?vista=inventada');
    await expect(page.locator('[data-page=dashboard]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explorar', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Personalizar' })).toBeVisible();
  });
});
