import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { MovementFormComponent } from './movement-form';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';

function prepararFormulario() {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.movimientos.ver, P.movimientos.crear] });
  store.form.set({ kind: 'expense' });
  return TestBed.createComponent(MovementFormComponent).componentInstance;
}

describe('formulario de movimiento: el modelo se escribe con un contrato', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('arranca con el tipo que mando el almacén y la operación normal', () => {
    const componente = prepararFormulario();

    expect(componente.model.kind).toBe('expense');
    expect(componente.model.operationType).toBe('normal');
    expect(componente.effectiveKind()).toBe('expense');
  });

  it('ignora un tipo de movimiento que no pertenece al contrato', () => {
    const componente = prepararFormulario();

    componente.setKind('transfer');

    expect(componente.model.kind).toBe('expense');
    expect(componente.effectiveKind()).toBe('expense');
  });

  it('cambia de tipo cuando el valor sí pertenece al contrato', () => {
    const componente = prepararFormulario();

    componente.setKind('income');

    expect(componente.model.kind).toBe('income');
  });

  it('ignora un tipo de operación que no pertenece al contrato', () => {
    const componente = prepararFormulario();

    componente.setOperationType('inventada');

    expect(componente.model.operationType).toBe('normal');
    expect(componente.effectiveKind()).toBe('expense');
  });

  it('la operación transferencia se refleja en el tipo efectivo', () => {
    const componente = prepararFormulario();

    componente.setOperationType('transfer');

    expect(componente.model.operationType).toBe('transfer');
    expect(componente.effectiveKind()).toBe('transfer');
  });
});

describe('formulario de movimiento: errores por campo', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('al guardar vacío marca cada campo faltante en vez de un solo error global', async () => {
    const componente = prepararFormulario();
    componente.setKind('expense');

    await componente.submit();

    expect(componente.errores.de('amount')).not.toBe('');
    expect(componente.errores.de('accountId')).not.toBe('');
    expect(componente.errores.de('description')).not.toBe('');
    expect(componente.errores.de('date')).toBe('');
    expect(componente.error()).not.toBe('');
  });

  it('al corregir un campo se limpia solo su error', async () => {
    const componente = prepararFormulario();
    await componente.submit();

    const entrada = document.createElement('input');
    entrada.setAttribute('name', 'amount');
    componente.alEditar({ target: entrada } as unknown as Event);

    expect(componente.errores.de('amount')).toBe('');
    expect(componente.errores.de('description')).not.toBe('');
  });

  it('no trae una tasa de cambio quemada: arranca vacía hasta conocer la TRM', () => {
    expect(prepararFormulario().model.exchangeRate).toBe(0);
  });
});
