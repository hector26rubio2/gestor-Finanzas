import { readFileSync } from 'node:fs';

const fixture = (nombre) => JSON.parse(readFileSync(new URL(`./fixtures/${nombre}.json`, import.meta.url), 'utf8'));

export const API_SIMULADA = 'http://api.invalido.local';

const clases = fixture('movement-kinds');
const banderas = fixture('feature-flags');
export const TODOS_LOS_PERMISOS = fixture('permisos');

const ahora = '2026-01-01T00:00:00Z';
const organizacion = {
  id: '10000000-0000-0000-0000-000000000001',
  name: 'Espacio de prueba',
  slug: 'prueba',
  baseCurrency: 'COP',
  isActive: true,
  createdAt: ahora,
};

const cuentas = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Ahorros de prueba', kind: 3 },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Efectivo de prueba', kind: 1 },
].map((cuenta) => ({
  ...cuenta,
  currency: 'COP',
  institution: null,
  lastFour: null,
  isDefault: false,
  isActive: true,
  createdAt: ahora,
}));

const categorias = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Mercado', type: 2, color: '#0d9488', icon: 'tag' },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Ocio', type: 2, color: '#d97706', icon: 'tag' },
  { id: 'c0000000-0000-0000-0000-000000000003', name: 'Sueldo', type: 1, color: '#4f46e5', icon: 'tag' },
].map((categoria) => ({ ...categoria, parent: null, isActive: true, createdAt: ahora }));

const dinero = (monto) => ({ amount: monto.toFixed(2), currency: 'COP' });

function movimiento(indice) {
  const clase = clases[indice % clases.length];
  const cuenta = cuentas[indice % cuentas.length];
  const dia = String((indice % 28) + 1).padStart(2, '0');
  return {
    id: `m0000000-0000-0000-0000-${String(indice).padStart(12, '0')}`,
    date: `2026-01-${dia}`,
    kind: clase.kind,
    effect: clase.allowedEffects[0],
    flow: clase.allowedFlows[0],
    amount: {
      original: dinero(1000 * (indice + 1)),
      base: dinero(1000 * (indice + 1)),
      rate: '1',
      rateAsOf: `2026-01-${dia}`,
    },
    links: { account: cuenta.id },
    linkNames: { account: { id: cuenta.id, name: cuenta.name } },
    origin: 1,
    description: `Movimiento de prueba ${indice + 1}`,
    createdAt: ahora,
    reversalOf: null,
    reversedBy: null,
    purchaseApr: null,
  };
}

const TOTAL_MOVIMIENTOS = 60;

function paginaDeMovimientos(cuerpo) {
  const pedido = cuerpo ? JSON.parse(cuerpo) : {};
  const pagina = pedido.page?.page ?? 1;
  const tamano = pedido.page?.size ?? 25;
  const desde = (pagina - 1) * tamano;
  const items = Array.from({ length: Math.max(0, Math.min(tamano, TOTAL_MOVIMIENTOS - desde)) }, (_, i) =>
    movimiento(desde + i),
  );
  return { items, page: pagina, size: tamano, total: TOTAL_MOVIMIENTOS };
}

export function sesionConPermisos(permisos) {
  return {
    user: {
      id: '20000000-0000-0000-0000-000000000001',
      displayName: 'Prueba',
      email: 'prueba@example.test',
      isActive: true,
    },
    organization: organizacion,
    capabilities: [],
    organizations: [],
    expiresAt: '2027-01-01T00:00:00Z',
    permissions: permisos,
  };
}

const json = (cuerpo) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });

export async function simularApi(context, { permisos = TODOS_LOS_PERMISOS, conDatos = true } = {}) {
  await context.route('**/api/v1/**', (route) => route.fulfill(json([])));
  await context.route('**/config.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.__FINANZAS_CONFIG__ = { apiBaseUrl: '${API_SIMULADA}' };`,
    }),
  );
  await context.route('**/api/v1/session', (route) => route.fulfill(json(sesionConPermisos(permisos))));
  await context.route('**/api/v1/feature-flags*', (route) => route.fulfill(json(banderas)));
  await context.route('**/api/v1/movement-kinds*', (route) => route.fulfill(json(clases)));
  await context.route('**/api/v1/preferences*', (route) => route.fulfill(json(null)));
  await context.route('**/api/v1/accounts*', (route) => route.fulfill(json(conDatos ? cuentas : [])));
  await context.route('**/api/v1/movements/search*', (route) =>
    route.fulfill(
      json(conDatos ? paginaDeMovimientos(route.request().postData()) : { items: [], page: 1, size: 25, total: 0 }),
    ),
  );
  await context.route('**/api/v1/dashboard?*', (route) => {
    const consulta = new URL(route.request().url()).searchParams;
    const hasta = consulta.get('to') ?? '2026-01-31';
    const desde = consulta.get('from') ?? '2026-01-01';
    const cero = dinero(0);
    return route.fulfill(
      json({
        period: { income: cero, expense: cero, net: cero, period: { start: desde, end: hasta } },
        accounts: [],
        cards: [],
        topCategories: [],
        series: [],
        asOf: hasta,
      }),
    );
  });
  await context.route('**/api/v1/categories*', (route) => route.fulfill(json(conDatos ? categorias : [])));
  await context.route('**/api/v1/budgets*', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill(
          json(
            conDatos
              ? [
                  {
                    id: 'b0000000-0000-0000-0000-000000000001',
                    category: { id: categorias[0].id, name: categorias[0].name },
                    monthlyLimit: dinero(500000),
                    updatedAt: ahora,
                  },
                ]
              : [],
          ),
        )
      : route.fulfill({ status: 204, body: '' }),
  );
  await context.route('**/api/v1/events*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': conectado\n\n' }),
  );
}
