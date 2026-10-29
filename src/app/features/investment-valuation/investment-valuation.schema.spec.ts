import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { beforeEach, describe, expect, it } from 'vitest';
import { type DatosDeValorizacion, esquemaDeValorizacion } from './investment-valuation.schema';

const base: DatosDeValorizacion = { date: '2026-10-29', value: 1200, source: '3', reference: '' };

function crear(cambios: Partial<DatosDeValorizacion>) {
  const modelo = signal({ ...base, ...cambios });
  return runInInjectionContext(TestBed.inject(Injector), () =>
    form(
      modelo,
      esquemaDeValorizacion((clave) => clave),
    ),
  );
}

describe('esquema de valorización de inversión', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('con fecha y valor es válida, la referencia es opcional', () => {
    expect(crear({})().valid()).toBe(true);
  });

  it('el valor debe ser mayor a cero', () => {
    expect(crear({ value: 0 }).value().errors()[0].message).toBe('form.investment.valuation.error.value');
    expect(crear({ value: null }).value().invalid()).toBe(true);
  });

  it('la fecha es obligatoria', () => {
    expect(crear({ date: '' }).date().errors()[0].message).toBe('form.management.error.startRequired');
  });
});
