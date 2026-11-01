import { describe, expect, it } from 'vitest';
import type { Account, Movement, ViewData } from '@core/state';
import { type ContextoDePresentacion, presentarEntidad } from './presentacion-de-entidad';

type Persona = ViewData['people'][number];
type Inversion = ViewData['investments'][number];

const saldos: Record<string, number> = { ahorros: 1500, visa: -300000 };

const contexto: ContextoDePresentacion = {
  t: (clave, parametros) => (parametros ? `${clave}|${JSON.stringify(parametros)}` : clave),
  money: (valor, moneda = 'COP') => `${moneda} ${valor}`,
  accountName: (id) => (id === 'ahorros' ? 'Ahorros' : id === 'visa' ? 'Visa' : undefined),
  accountType: (id) => (id === 'visa' ? 'credit' : 'savings'),
  fechaLarga: (iso) => `largo:${iso}`,
  saldoDe: (cuenta) => saldos[cuenta.id] ?? 0,
};

const ahorros: Account = { id: 'ahorros', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 };
const visa: Account = {
  id: 'visa',
  name: 'Visa',
  type: 'credit',
  currency: 'COP',
  openingBalance: 0,
  limit: 5_000_000,
  cutDay: 10,
  dueDay: 25,
};
const movimiento: Movement = {
  id: 'mov-1',
  date: '2026-10-01',
  description: 'Mercado',
  accountId: 'ahorros',
  category: 'Mercado',
  kind: 'expense',
  amount: -45_900,
  status: 'confirmed',
};
const persona: Persona = { id: 'p1', name: 'Camilo', owed: 90_000, owing: 20_000 };
const inversion: Inversion = {
  id: 'i1',
  name: 'CDT Bancolombia',
  type: 'CDT',
  value: 1_100_000,
  cost: 1_000_000,
  currency: 'COP',
  netContributions: 1_000_000,
  sinValoracion: false,
};

describe('presentarEntidad', () => {
  it('movimiento: titulo generico, descripcion, monto con signo y hechos del movimiento', () => {
    const presentacion = presentarEntidad({ tipo: 'movimiento', movimiento }, contexto);
    expect(presentacion.titulo).toBe('workspace.inspector.title.movement');
    expect(presentacion.subtitulo).toBe('Mercado');
    expect(presentacion.monto).toBe('COP -45900');
    expect(presentacion.hechos[0]).toEqual(['workspace.inspector.facts.date', '2026-10-01']);
    expect(presentacion.hechos.map(([clave]) => clave)).toContain('workspace.inspector.facts.installments');
  });

  it('cuenta: titulo de cuenta, nombre como subtitulo y saldo', () => {
    const presentacion = presentarEntidad({ tipo: 'cuenta', cuenta: ahorros }, contexto);
    expect(presentacion.titulo).toBe('workspace.inspector.title.account');
    expect(presentacion.subtitulo).toBe('Ahorros');
    expect(presentacion.monto).toBe('COP 1500');
    expect(presentacion.hechos.map(([clave]) => clave)).toEqual([
      'workspace.inspector.facts.lastFour',
      'workspace.inspector.facts.currency',
    ]);
  });

  it('tarjeta: nombre como titulo, deuda positiva como monto y corte, vencimiento y cupo', () => {
    const presentacion = presentarEntidad({ tipo: 'tarjeta', cuenta: visa }, contexto);
    expect(presentacion.titulo).toBe('Visa');
    expect(presentacion.subtitulo).toBe('Visa');
    expect(presentacion.monto).toBe('COP 300000');
    expect(presentacion.hechos.map(([clave]) => clave)).toEqual([
      'workspace.inspector.facts.lastFour',
      'workspace.inspector.facts.currency',
      'workspace.inspector.facts.cutoff',
      'workspace.inspector.facts.dueDate',
      'workspace.inspector.facts.limit',
    ]);
  });

  it('tarjeta con saldo a favor muestra deuda cero', () => {
    const presentacion = presentarEntidad(
      { tipo: 'tarjeta', cuenta: { ...visa, id: 'otra' } },
      {
        ...contexto,
        saldoDe: () => 5000,
      },
    );
    expect(presentacion.monto).toBe('COP 0');
  });

  it('dia: fecha larga en el titulo y cantidad de operaciones como monto', () => {
    const presentacion = presentarEntidad({ tipo: 'dia', fecha: '2026-10-01', operaciones: 3 }, contexto);
    expect(presentacion.titulo).toBe('workspace.inspector.title.day|{"date":"largo:2026-10-01"}');
    expect(presentacion.subtitulo).toBe('workspace.inspector.defaultSubtitle');
    expect(presentacion.monto).toBe('workspace.inspector.operationsCount|{"count":3}');
    expect(presentacion.hechos).toEqual([
      ['workspace.inspector.facts.date', '2026-10-01'],
      ['workspace.inspector.facts.operations', '3'],
    ]);
  });

  it('persona: nombre, balance a favor y hechos de deudas', () => {
    const presentacion = presentarEntidad({ tipo: 'persona', persona }, contexto);
    expect(presentacion.titulo).toBe('Camilo');
    expect(presentacion.subtitulo).toBe('Camilo');
    expect(presentacion.monto).toBe('COP 70000');
    expect(presentacion.hechos).toEqual([
      ['workspace.inspector.facts.owed', 'COP 90000'],
      ['workspace.inspector.facts.owing', 'COP 20000'],
      ['workspace.inspector.facts.balance', 'COP 70000'],
    ]);
  });

  it('inversion: nombre, tipo como subtitulo y valor en su moneda', () => {
    const presentacion = presentarEntidad({ tipo: 'inversion', inversion }, contexto);
    expect(presentacion.titulo).toBe('CDT Bancolombia');
    expect(presentacion.subtitulo).toBe('CDT');
    expect(presentacion.monto).toBe('COP 1100000');
    expect(presentacion.hechos.map(([clave]) => clave)).toContain('workspace.inspector.facts.gain');
  });

  it('una entidad que aun no carga muestra el titulo generico y nada mas', () => {
    expect(presentarEntidad({ tipo: 'persona' }, contexto)).toEqual({
      titulo: 'workspace.inspector.title.person',
      subtitulo: 'workspace.inspector.defaultSubtitle',
      monto: '',
      hechos: [],
    });
    expect(presentarEntidad({ tipo: 'inversion' }, contexto).titulo).toBe('workspace.inspector.title.investment');
    expect(presentarEntidad({ tipo: 'tarjeta' }, contexto).titulo).toBe('workspace.inspector.title.card');
    expect(presentarEntidad({ tipo: 'movimiento' }, contexto).monto).toBe('');
  });
});
