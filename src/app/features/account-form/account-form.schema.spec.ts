import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { beforeEach, describe, expect, it } from 'vitest';
import { type DatosDeCuenta, esquemaDeCuenta } from './account-form.schema';

const base: DatosDeCuenta = {
  name: 'Ahorro',
  type: 'savings',
  currency: 'COP',
  opening: 0,
  lastFour: '',
  exchangeRate: 4000,
  issuerId: '',
  limit: 5000000,
  cutDay: 20,
  dueDay: 5,
  monthlyRate: 2,
  monthlyFee: 0,
  monedaDePrioridad: 'pesos',
  abonoDePrueba: 0,
};

function crear(cambios: Partial<DatosDeCuenta>) {
  const modelo = signal({ ...base, ...cambios });
  const formulario = runInInjectionContext(TestBed.inject(Injector), () =>
    form(
      modelo,
      esquemaDeCuenta((clave) => clave),
    ),
  );
  return { modelo, formulario };
}

describe('esquema de la cuenta', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una cuenta de ahorro con datos completos es válida', () => {
    expect(crear({}).formulario().valid()).toBe(true);
  });

  it('el nombre es obligatorio', () => {
    const { formulario } = crear({ name: '' });

    expect(formulario.name().errors()[0].message).toBe('form.error.nameRequired');
    expect(formulario().invalid()).toBe(true);
  });

  it('los últimos cuatro dígitos son opcionales, pero si se escriben deben ser cuatro números', () => {
    expect(crear({ lastFour: '' }).formulario.lastFour().valid()).toBe(true);
    expect(crear({ lastFour: '1234' }).formulario.lastFour().valid()).toBe(true);
    expect(crear({ lastFour: '12' }).formulario.lastFour().errors()[0].message).toBe('form.account.error.lastFour');
    expect(crear({ lastFour: '12a4' }).formulario.lastFour().invalid()).toBe(true);
  });

  it('los datos de crédito no se validan en una cuenta que no es tarjeta', () => {
    const { formulario } = crear({ limit: null, cutDay: 99, dueDay: null });

    expect(formulario.limit().hidden()).toBe(true);
    expect(formulario().valid()).toBe(true);
  });

  it('una tarjeta exige cupo mayor a cero y días de corte y pago entre 1 y 31', () => {
    const sinCupo = crear({ type: 'credit', limit: 0 });
    const diaFuera = crear({ type: 'credit', cutDay: 32, dueDay: 0 });
    const completa = crear({ type: 'credit' });

    expect(sinCupo.formulario.limit().errors()[0].message).toBe('form.account.error.creditLimit');
    expect(diaFuera.formulario.cutDay().errors()[0].message).toBe('form.account.error.dayRange');
    expect(diaFuera.formulario.dueDay().errors()[0].message).toBe('form.account.error.dayRange');
    expect(completa.formulario().valid()).toBe(true);
  });

  it('la tasa mensual de una tarjeta va de 0 a 100 y la cuota de manejo no es negativa', () => {
    const { formulario } = crear({ type: 'credit', monthlyRate: 101, monthlyFee: -1 });

    expect(formulario.monthlyRate().errors()[0].message).toBe('form.movement.error.rateInvalid');
    expect(formulario.monthlyFee().errors()[0].message).toBe('form.account.error.monthlyFee');
  });

  it('la TRM solo se valida en una cuenta en dólares que no es tarjeta', () => {
    expect(crear({ currency: 'COP', exchangeRate: 0 }).formulario().valid()).toBe(true);
    expect(crear({ currency: 'USD', exchangeRate: 0 }).formulario.exchangeRate().errors()[0].message).toBe(
      'form.account.error.exchangeRate',
    );
    expect(crear({ currency: 'USD', type: 'credit', exchangeRate: 0 }).formulario.exchangeRate().hidden()).toBe(true);
  });

  it('cambiar el tipo a tarjeta activa las reglas de crédito', () => {
    const { modelo, formulario } = crear({ limit: 0 });
    expect(formulario().valid()).toBe(true);

    modelo.update((datos) => ({ ...datos, type: 'credit' }));

    expect(formulario.limit().invalid()).toBe(true);
  });
});
