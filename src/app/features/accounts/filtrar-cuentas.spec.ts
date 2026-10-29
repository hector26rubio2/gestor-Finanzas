import { describe, expect, it } from 'vitest';
import type { Account } from '@core/state';
import { filtrarCuentas } from './filtrar-cuentas';

const cuenta = (name: string, type: Account['type'], lastFour?: string): Account => ({
  id: name,
  name,
  type,
  currency: 'COP',
  openingBalance: 0,
  lastFour,
});

const cuentas = [cuenta('Ahorros İstanbul', 'savings'), cuenta('Visa', 'credit', '4242'), cuenta('Efectivo', 'cash')];

describe('filtrarCuentas', () => {
  it('sin texto ni tipo devuelve todas', () => {
    expect(filtrarCuentas(cuentas, '', 'all', 'es')).toHaveLength(3);
  });

  it('busca por nombre sin distinguir mayusculas', () => {
    expect(filtrarCuentas(cuentas, ' VIS ', 'all', 'es').map((c) => c.name)).toEqual(['Visa']);
  });

  it('busca por los ultimos cuatro digitos', () => {
    expect(filtrarCuentas(cuentas, '4242', 'all', 'es').map((c) => c.name)).toEqual(['Visa']);
  });

  it('filtra por tipo', () => {
    expect(filtrarCuentas(cuentas, '', 'cash', 'es').map((c) => c.name)).toEqual(['Efectivo']);
  });

  it('usa el locale recibido para minusculas', () => {
    expect(filtrarCuentas(cuentas, 'ISTANBUL', 'all', 'tr')).toHaveLength(0);
    expect(filtrarCuentas(cuentas, 'ıstanbul', 'all', 'tr')).toHaveLength(0);
    expect(filtrarCuentas([cuenta('IRMAK', 'cash')], 'ırmak', 'all', 'tr')).toHaveLength(1);
    expect(filtrarCuentas([cuenta('IRMAK', 'cash')], 'ırmak', 'all', 'es')).toHaveLength(0);
  });
});
