import type { ClienteApi } from './api';

export const nombres = {
  ahorros: 'Ahorros principal',
  corriente: 'Cuenta corriente',
  efectivo: 'Efectivo',
  dolares: 'Billetera USD',
  tarjeta: 'Visa Oro',
  persona: 'Laura Gómez',
  entidad: 'Banco Andino',
  inversion: 'Fondo indexado global',
  salario: 'Salario',
  mercado: 'Mercado',
  servicios: 'Servicios',
  restaurantes: 'Restaurantes',
} as const;

const dinero = (monto: number, moneda = 'COP') => ({ amount: String(monto), currency: moneda });
const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);
const diaDeMes = (mesesAtras: number, dia: number) => {
  const hoy = new Date();
  return iso(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - mesesAtras, Math.min(dia, 28))));
};

async function asegurar(api: ClienteApi, ruta: string, nombre: string, crear: () => Promise<any>): Promise<string> {
  const existentes = await api.exigir('GET', ruta);
  const items: any[] = Array.isArray(existentes) ? existentes : (existentes.items ?? []);
  const hallado = items.find((item) => (item.name ?? item.displayName) === nombre);
  if (hallado) return hallado.id;
  const creado = await crear();
  return creado.id ?? creado.account?.id;
}

const tasa = (valor: number) => ({ rate: String(valor) });

async function sembrarCuentas(api: ClienteApi) {
  const cuenta = (nombre: string, tipo: number, moneda: string, saldo: number, porDefecto: boolean) =>
    asegurar(api, '/api/v1/accounts', nombre, () =>
      api.exigir('POST', '/api/v1/accounts/with-opening', {
        account: { name: nombre, kind: tipo, currency: moneda, institution: 'Banco Andino', isDefault: porDefecto },
        openingBalance: dinero(saldo, moneda),
        date: diaDeMes(3, 1),
        rate: moneda === 'USD' ? '4100' : null,
        idempotencyKey: `e2e-cuenta-${nombre}`,
      }),
    );
  return {
    ahorros: await cuenta(nombres.ahorros, 3, 'COP', 9_500_000, true),
    corriente: await cuenta(nombres.corriente, 2, 'COP', 2_500_000, false),
    efectivo: await cuenta(nombres.efectivo, 1, 'COP', 400_000, false),
    dolares: await cuenta(nombres.dolares, 4, 'USD', 1200, false),
  };
}

function sembrarTarjeta(api: ClienteApi) {
  return asegurar(api, '/api/v1/cards', nombres.tarjeta, () =>
    api.exigir('POST', '/api/v1/cards', {
      name: nombres.tarjeta,
      currency: 'COP',
      creditLimit: dinero(14_000_000),
      cycle: { statementDay: 25, paymentDueDay: 10 },
      terms: {
        purchaseApr: tasa(0.28),
        cashAdvanceApr: tasa(0.32),
        internationalPurchaseApr: tasa(0.28),
        deferredDefaultApr: tasa(0.3),
        minimumPaymentRate: tasa(0.05),
        minimumPaymentFloor: dinero(50_000),
        gracePeriodDays: 20,
      },
      issuer: 'Banco Andino',
      lastFour: '4417',
    }),
  );
}

async function sembrarCatalogos(api: ClienteApi) {
  const categoria = (nombre: string, tipo: number, color: string, icono: string) =>
    asegurar(api, '/api/v1/categories', nombre, () =>
      api.exigir('POST', '/api/v1/categories', { name: nombre, type: tipo, color, icon: icono }),
    );
  return {
    salario: await categoria(nombres.salario, 1, '#16a34a', 'wallet'),
    mercado: await categoria(nombres.mercado, 2, '#ea580c', 'cart'),
    servicios: await categoria(nombres.servicios, 2, '#0284c7', 'bolt'),
    restaurantes: await categoria(nombres.restaurantes, 2, '#db2777', 'utensils'),
    persona: await asegurar(api, '/api/v1/people', nombres.persona, () =>
      api.exigir('POST', '/api/v1/people', { displayName: nombres.persona }),
    ),
    entidad: await asegurar(api, '/api/v1/people', nombres.entidad, () =>
      api.exigir('POST', '/api/v1/people', { displayName: nombres.entidad, kind: 2 }),
    ),
    inversion: await asegurar(api, '/api/v1/investments', nombres.inversion, () =>
      api.exigir('POST', '/api/v1/investments', {
        name: nombres.inversion,
        instrumentType: 'fund',
        currency: 'COP',
        risk: 2,
        symbol: 'FIG',
        institution: 'Casa de bolsa',
      }),
    ),
  };
}

async function sembrarMovimientos(api: ClienteApi, ids: any) {
  const catalogo = await api.exigir('GET', '/api/v1/movement-kinds');
  const especificaciones = new Map<number, any>(
    (Array.isArray(catalogo) ? catalogo : catalogo.items).map((e: any) => [e.kind, e]),
  );
  const hoy = iso(new Date());
  const movimiento = async (
    clave: string,
    fecha: string,
    tipo: number,
    monto: number,
    vinculos: object,
    descripcion: string,
  ) =>
    fecha > hoy
      ? null
      : api.exigir('POST', '/api/v1/movements', {
          date: fecha,
          kind: tipo,
          effect: especificaciones.get(tipo)?.allowedEffects?.[0] ?? 0,
          flow: especificaciones.get(tipo)?.allowedFlows?.[0] ?? 0,
          amount: dinero(monto),
          links: vinculos,
          description: descripcion,
          idempotencyKey: `e2e-semilla-${clave}`,
        });
  for (let atras = 3; atras >= 0; atras -= 1) {
    const clave = `m${atras}`;
    await movimiento(
      `${clave}-salario`,
      diaDeMes(atras, 1),
      1,
      7_800_000,
      { account: ids.cuentas.ahorros, category: ids.catalogos.salario },
      'Salario mensual',
    );
    await movimiento(
      `${clave}-servicios`,
      diaDeMes(atras, 8),
      2,
      320_000,
      { account: ids.cuentas.corriente, category: ids.catalogos.servicios },
      'Energía, agua y gas',
    );
    for (let semana = 0; semana < 4; semana += 1) {
      await movimiento(
        `${clave}-mercado-${semana}`,
        diaDeMes(atras, 4 + semana * 7),
        20,
        180_000 + semana * 25_000,
        { card: ids.tarjeta, category: ids.catalogos.mercado },
        'Mercado semanal',
      );
      await movimiento(
        `${clave}-restaurante-${semana}`,
        diaDeMes(atras, 5 + semana * 7),
        2,
        60_000 + semana * 10_000,
        { account: ids.cuentas.efectivo, category: ids.catalogos.restaurantes },
        'Restaurante',
      );
    }
    const fechaPago = diaDeMes(atras, 10);
    if (fechaPago <= hoy)
      await api.exigir('POST', '/api/v1/operations/card-payments', {
        date: fechaPago,
        amount: dinero(900_000),
        account: ids.cuentas.ahorros,
        card: ids.tarjeta,
        description: 'Pago Visa Oro',
        idempotencyKey: `e2e-semilla-${clave}-pago`,
      });
  }
}

export async function sembrarBase(api: ClienteApi) {
  const ids: any = { cuentas: await sembrarCuentas(api) };
  ids.tarjeta = await sembrarTarjeta(api);
  ids.catalogos = await sembrarCatalogos(api);
  await sembrarMovimientos(api, ids);
  return ids;
}
