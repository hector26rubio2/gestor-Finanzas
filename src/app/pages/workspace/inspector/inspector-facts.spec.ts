import { describe, expect, it } from 'vitest';
import type { Account, Movement, ViewData } from '@core/state';
import es from '@core/i18n/es';
import { hechosDeCuenta, hechosDeInversion, hechosDeMovimiento } from './inspector-facts';

const cuentas: Record<string, Account> = {
  ahorros: { id: 'ahorros', name: 'Ahorros', type: 'savings', currency: 'COP' } as Account,
  visa: { id: 'visa', name: 'Visa', type: 'credit', currency: 'COP' } as Account,
};

const t = (clave: string, params: Record<string, string | number> = {}) =>
  Object.entries(params).reduce(
    (texto, [nombre, valor]) => texto.replace(`{${nombre}}`, String(valor)),
    (es as Record<string, string>)[clave] ?? clave,
  );

const contexto = {
  t,
  money: (valor: number) => String(valor),
  accountName: (id: string) => cuentas[id]?.name,
  accountType: (id: string) => cuentas[id]?.type,
};

function movimiento(extra: Partial<Movement>): Movement {
  return {
    id: 'm',
    date: '2026-10-28',
    description: 'x',
    accountId: 'ahorros',
    category: '',
    kind: 'income',
    status: 'confirmed',
    amount: 2_000_000,
    ...extra,
  };
}

const hecho = (m: Movement, etiqueta: string) =>
  new Map(hechosDeMovimiento(m, contexto)).get(es[etiqueta as keyof typeof es] as string);

describe('hechosDeMovimiento', () => {
  it('un saldo inicial de ahorros dice Entrada, Confirmado, sin cuotas y sin recurrencia', () => {
    const saldo = movimiento({});
    expect(hecho(saldo, 'workspace.inspector.facts.nature')).toBe('Entrada');
    expect(hecho(saldo, 'workspace.inspector.facts.status')).toBe('Confirmado');
    expect(hecho(saldo, 'workspace.inspector.facts.installments')).toBe('—');
    expect(hecho(saldo, 'workspace.inspector.facts.recurrence')).toBe('—');
  });

  it('una compra con tarjeta es una Salida a una cuota y un gasto mensual muestra ✓ Mensual', () => {
    const compra = movimiento({ accountId: 'visa', kind: 'expense', amount: -50_000 });
    expect(hecho(compra, 'workspace.inspector.facts.nature')).toBe('Salida');
    expect(hecho(compra, 'workspace.inspector.facts.installments')).toBe('Una cuota');
    const arriendo = movimiento({ kind: 'expense', amount: -1_000, recurring: true, recurrence: 'monthly' });
    expect(hecho(arriendo, 'workspace.inspector.facts.recurrence')).toBe('✓ Mensual');
    expect(hecho(movimiento({ status: 'pending' }), 'workspace.inspector.facts.status')).toBe('Pendiente');
  });
});

describe('hechosDeCuenta', () => {
  const etiquetas = (cuenta: Account) => hechosDeCuenta(cuenta, contexto).map(([etiqueta]) => etiqueta);
  const deTarjeta = ['cutoff', 'dueDate', 'limit'].map((c) => es[`workspace.inspector.facts.${c}` as keyof typeof es]);

  it('una cuenta débito en pesos no muestra corte, pago, límite ni tasa', () => {
    const vistas = etiquetas(cuentas['ahorros']);
    expect(vistas).not.toContain(es['workspace.inspector.facts.referenceRate']);
    deTarjeta.forEach((etiqueta) => expect(vistas).not.toContain(etiqueta));
  });

  it('una tarjeta muestra corte, pago y límite', () => {
    const tarjeta = { ...cuentas['visa'], cutDay: 15, dueDay: 30, limit: 1_000 } as Account;
    expect(new Map(hechosDeCuenta(tarjeta, contexto)).get(deTarjeta[0])).toBe('15');
    deTarjeta.forEach((etiqueta) => expect(etiquetas(tarjeta)).toContain(etiqueta));
  });
});

describe('hechosDeInversion', () => {
  const contextoConMoneda = {
    ...contexto,
    money: (valor: number, moneda = 'COP') => `${moneda} ${valor}`,
  };
  const inversion: ViewData['investments'][number] = {
    id: 'i1',
    name: 'ETF',
    type: 'Fondo',
    currency: 'USD',
    cost: 1000,
    value: 1200,
    netContributions: 900,
    units: 2.5,
    risk: 'Alto',
    institution: 'Broker',
    valuedAt: '2026-10-01',
    sinValoracion: false,
  };
  const hechos = (i: ViewData['investments'][number]) => new Map(hechosDeInversion(i, contextoConMoneda));

  it('muestra instrumento, riesgo, institución, unidades y montos en la moneda de la inversión', () => {
    const mapa = hechos(inversion);

    expect(mapa.get('Instrumento')).toBe('Fondo');
    expect(mapa.get('Riesgo')).toBe('Alto');
    expect(mapa.get('Institución')).toBe('Broker');
    expect(mapa.get('Unidades')).toBe('2.5');
    expect(mapa.get('Aportes netos')).toBe('USD 900');
    expect(mapa.get('Costo')).toBe('USD 1000');
    expect(mapa.get('Valor')).toBe('USD 1200');
    expect(mapa.get('Ganancia no realizada')).toBe('USD 200');
    expect(mapa.get('Última valorización')).toBe('2026-10-01');
  });

  it('sin valorización lo dice y no inventa ganancia', () => {
    const mapa = hechos({ ...inversion, value: 1000, valuedAt: undefined, sinValoracion: true });

    expect(mapa.get('Última valorización')).toBe('Sin valorización');
    expect(mapa.get('Ganancia no realizada')).toBe('USD 0');
  });

  it('sin institución ni riesgo muestra el marcador de sin dato', () => {
    const mapa = hechos({ ...inversion, institution: undefined, risk: undefined });

    expect(mapa.get('Institución')).toBe('—');
    expect(mapa.get('Riesgo')).toBe('—');
  });
});
