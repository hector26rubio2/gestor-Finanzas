import { afterEach, describe, expect, it } from 'vitest';
import { accountBalance, type Account, type Movement } from '@core/state';
import { BASE_CURRENCY, baseCurrency } from '@core/utils';

type GlobDeVite = (patron: string, opciones: { query: string; import: string; eager: true }) => Record<string, string>;

const fuentes = (import.meta as unknown as { glob: GlobDeVite }).glob('/src/app/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const normalizar = (clave: string): string => {
  const inicio = clave.indexOf('src/app/');
  return inicio < 0 ? clave : clave.slice(inicio);
};

const indiceDeFuentes = new Map(Object.entries(fuentes).map(([clave, texto]) => [normalizar(clave), texto]));

const FICHEROS_DE_IMPORTES = [
  'src/app/core/state/view-model.ts',
  'src/app/features/people/people-tab.ts',
  'src/app/features/portfolio/portfolio-tab.ts',
  'src/app/features/planning/planning-tab.ts',
  'src/app/features/reports/reports-tab.ts',
  'src/app/pages/dashboard/dashboard.ts',
  'src/app/pages/dashboard/dashboard-kpis.ts',
  'src/app/pages/workspace/inspector/inspector.ts',
];

const KPI_DE_DIAS = 'src/app/pages/dashboard/dashboard-kpis.ts';

const EXCEPCIONES: Record<string, (linea: string) => boolean> = {
  [KPI_DE_DIAS]: (linea) => linea.includes('averagePaymentDays'),
};

const acumulacionesDe = (ruta: string): string[] => {
  const fuente = indiceDeFuentes.get(ruta);
  if (fuente === undefined) throw new Error(`la fuente ${ruta} no está en el índice`);
  const permitida = EXCEPCIONES[ruta];
  return fuente
    .split('\n')
    .map((linea, indice) => ({ linea, indice: indice + 1 }))
    .filter(({ linea }) => linea.includes('.reduce(') && !(permitida?.(linea) ?? false))
    .map(({ linea, indice }) => `${ruta}:${indice} → ${linea.trim()}`);
};

describe('los importes se acumulan con sumas exactas', () => {
  it('ningún fichero de dinero sigue acumulando con reduce', () => {
    const acumulaciones = FICHEROS_DE_IMPORTES.flatMap(acumulacionesDe);
    expect(acumulaciones, `reduce sobre importes sin justificar: ${acumulaciones.join(' | ')}`).toEqual([]);
  });

  it('la única excepción de la lista sigue siendo un promedio de días', () => {
    const fuente = indiceDeFuentes.get(KPI_DE_DIAS) ?? '';
    const restantes = fuente.split('\n').filter((linea) => linea.includes('.reduce('));
    expect(restantes, `sobran excepciones en ${KPI_DE_DIAS}: ${restantes.join(' | ')}`).toHaveLength(1);
    expect(restantes[0]).toContain('averagePaymentDays');
  });

  it('un saldo en una moneda de dos decimales no pierde centavos', () => {
    baseCurrency.set('USD');
    const cuenta: Account = {
      id: 'a-centavos',
      name: 'Cuenta en dólares',
      type: 'checking',
      currency: 'USD',
      openingBalance: 0,
    };
    const movimientos: Movement[] = [
      {
        id: 'm-1',
        date: '2026-09-01',
        description: 'Compra',
        accountId: 'a-centavos',
        category: 'Comida',
        kind: 'expense',
        amount: 0.1,
        status: 'confirmed',
      },
      {
        id: 'm-2',
        date: '2026-09-02',
        description: 'Compra',
        accountId: 'a-centavos',
        category: 'Comida',
        kind: 'expense',
        amount: 0.2,
        status: 'confirmed',
      },
      {
        id: 'm-3',
        date: '2026-09-03',
        description: 'Pendiente',
        accountId: 'a-centavos',
        category: 'Comida',
        kind: 'expense',
        amount: 5.55,
        status: 'pending',
      },
    ];

    expect(0 + 0.1 + 0.2).not.toBe(0.3);
    expect(accountBalance(cuenta, movimientos)).toBe(0.3);
  });

  afterEach(() => baseCurrency.set(BASE_CURRENCY));
});
