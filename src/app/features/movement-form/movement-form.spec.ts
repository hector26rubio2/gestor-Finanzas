import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '../../core/api/api-client';
import { P } from '../../core/session/permissions';
import { RUNTIME_CONFIG } from '../../core/session/runtime';
import { AppStore } from '../../core/state/store';
import { MovementFormComponent } from './movement-form';

function prepararFormulario() {
  window.__FINANZAS_CONFIG__ = { mode: 'demo' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
      { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({ ...store.users[0], capabilities: [P.movimientos.ver, P.movimientos.crear] });
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
