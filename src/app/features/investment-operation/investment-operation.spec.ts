import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { InvestmentOperationComponent } from './investment-operation';

async function abrir() {
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
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.patrimonio.ver, P.patrimonio.inversiones.editar] });
  store.form.set({ kind: 'investment-operation', targetId: 'inv-1' });
  const fixture = TestBed.createComponent(InvestmentOperationComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function nombreDe(control: Element): string {
  return control.getAttribute('aria-label')?.trim() ?? '';
}

function controles(): Element[] {
  return [...document.body.querySelectorAll('form input, form button[type=button]')].filter(
    (control) => !control.closest('fin-select') && !control.closest('footer'),
  );
}

describe('formulario de operación de inversión', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('monto, descripción y fecha tienen nombre accesible', async () => {
    await abrir();

    const sinNombre = controles().filter((control) => nombreDe(control) === '');

    expect(sinNombre.map((control) => control.outerHTML.slice(0, 90))).toEqual([]);
  });

  it('cantidad y precio unitario tienen nombre accesible en una compra', async () => {
    const fixture = await abrir();
    fixture.componentInstance.modelo.update((modelo) => ({ ...modelo, type: '3' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const sinNombre = controles().filter((control) => nombreDe(control) === '');

    expect(controles().length).toBeGreaterThanOrEqual(5);
    expect(sinNombre.map((control) => control.outerHTML.slice(0, 90))).toEqual([]);
  });
});
