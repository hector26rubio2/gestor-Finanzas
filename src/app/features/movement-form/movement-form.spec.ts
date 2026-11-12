import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { TrmApi } from '@core/api/trm.api';
import { AppStore, CatalogCommands } from '@core/state';
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

describe('formulario de movimiento: crear cuenta al vuelo', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function abrir(permisos: readonly string[]) {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
        { provide: FinanceApiClient, useValue: { dashboard: vi.fn(() => of(null)) } },
        { provide: TrmApi, useValue: { today: () => of(4012.5) } },
      ],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.movimientos.ver, P.movimientos.crear, ...permisos] });
    store.form.set({ kind: 'expense' });
    const fixture = TestBed.createComponent(MovementFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, componente: fixture.componentInstance };
  }

  const accesoRapido = () => document.body.querySelector<HTMLButtonElement>('[data-tour="form-cuenta-nueva"]');
  const guardarCuenta = () => document.body.querySelector<HTMLButtonElement>('[data-tour="form-cuenta-guardar"]')!;
  const formularioDeCuenta = () => document.body.querySelector('[data-tour="form-cuenta-guardar"]');

  async function esperar(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('con permiso de cuentas muestra «Nueva cuenta» junto al selector de cuenta', async () => {
    await abrir([P.cuentas.crear, P.cuentas.ahorro.crear]);

    expect(accesoRapido()?.getAttribute('aria-label')).toBe('Nueva cuenta');
  });

  it('sin permiso para crear cuentas no aparece el acceso rápido', async () => {
    await abrir([P.cuentas.ver]);

    expect(accesoRapido()).toBeNull();
  });

  it('al guardar la cuenta nueva queda seleccionada y lo escrito sigue intacto', async () => {
    const { fixture, store, componente } = await abrir([P.cuentas.crear, P.cuentas.efectivo.crear]);
    const creada = { id: 'cuenta-nueva', name: 'Billetera', type: 'cash', currency: 'COP', openingBalance: 0 } as const;
    vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount').mockResolvedValue(creada);
    componente.model['description'] = 'Almuerzo';
    componente.model['amount'] = 12000;

    accesoRapido()!.click();
    await esperar(fixture);
    expect(formularioDeCuenta()).not.toBeNull();
    const nombre = document.body.querySelector<HTMLInputElement>('input[name="cuenta.name"]')!;
    nombre.value = 'Billetera';
    nombre.dispatchEvent(new Event('input'));
    await esperar(fixture);
    guardarCuenta().click();

    await vi.waitFor(() => expect(componente.model['accountId']).toBe('cuenta-nueva'));
    await esperar(fixture);
    expect(componente.model['description']).toBe('Almuerzo');
    expect(componente.model['amount']).toBe(12000);
    expect(store.form()?.kind).toBe('expense');
    expect(formularioDeCuenta()).toBeNull();
  });

  it('cancelar vuelve al movimiento tal como estaba', async () => {
    const { fixture, store, componente } = await abrir([P.cuentas.crear, P.cuentas.ahorro.crear]);
    componente.model['description'] = 'Mercado';
    const crear = vi.spyOn(TestBed.inject(CatalogCommands), 'createAccount');

    accesoRapido()!.click();
    await esperar(fixture);
    const cancelar = guardarCuenta().parentElement!.querySelector<HTMLButtonElement>('button')!;
    cancelar.click();
    await esperar(fixture);

    expect(formularioDeCuenta()).toBeNull();
    expect(componente.model['description']).toBe('Mercado');
    expect(componente.model['accountId']).toBe('');
    expect(store.form()?.kind).toBe('expense');
    expect(crear).not.toHaveBeenCalled();
  });
});
