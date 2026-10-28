import { describe, expect, it } from 'vitest';
import type { Account, Movement } from '@core/state';
import es from '@core/i18n/es';
import { hechosDeMovimiento } from './inspector-facts';

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
