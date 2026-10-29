import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { beforeEach, describe, expect, it } from 'vitest';
import { type DatosDeOperacion, esquemaDeOperacion } from './investment-operation.schema';

const base: DatosDeOperacion = {
  type: '1',
  date: '2026-10-29',
  amount: 100,
  account: 'cuenta-1',
  quantity: null,
  unitPrice: null,
  description: '',
};

function crear(cambios: Partial<DatosDeOperacion>) {
  const modelo = signal({ ...base, ...cambios });
  const formulario = runInInjectionContext(TestBed.inject(Injector), () =>
    form(
      modelo,
      esquemaDeOperacion((clave) => clave),
    ),
  );
  return { modelo, formulario };
}

describe('esquema de operación de inversión', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un aporte con fecha, monto y cuenta es válido', () => {
    expect(crear({}).formulario().valid()).toBe(true);
  });

  it('el monto debe ser mayor a cero', () => {
    expect(crear({ amount: 0 }).formulario.amount().errors()[0].message).toBe('form.movement.error.amountPositive');
    expect(crear({ amount: null }).formulario.amount().invalid()).toBe(true);
  });

  it('la fecha es obligatoria', () => {
    expect(crear({ date: '' }).formulario.date().errors()[0].message).toBe('form.management.error.startRequired');
  });

  it('la cuenta es obligatoria en aporte y retiro', () => {
    for (const type of ['1', '2'])
      expect(crear({ type, account: '' }).formulario.account().errors()[0].message).toBe(
        'form.investment.operation.error.accountRequired',
      );
  });

  it('la cuenta es opcional en compra, venta, dividendo y comisión', () => {
    for (const type of ['3', '4', '5', '6'])
      expect(crear({ type, account: '', quantity: 1, unitPrice: 1 }).formulario.account().valid()).toBe(true);
  });

  it('cantidad y precio solo se piden en compra y venta', () => {
    const aporte = crear({ type: '1' });
    expect(aporte.formulario.quantity().hidden()).toBe(true);
    expect(aporte.formulario.unitPrice().hidden()).toBe(true);

    const compra = crear({ type: '3', quantity: null, unitPrice: 0 });
    expect(compra.formulario.quantity().hidden()).toBe(false);
    expect(compra.formulario.quantity().errors()[0].message).toBe('form.investment.operation.error.quantity');
    expect(compra.formulario.unitPrice().errors()[0].message).toBe('form.investment.operation.error.unitPrice');
    expect(crear({ type: '4', quantity: 2, unitPrice: 50 }).formulario().valid()).toBe(true);
  });
});
