import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { InvestmentValuationComponent } from './investment-valuation';

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
  store.form.set({ kind: 'investment-valuation', targetId: 'inv-1' });
  const fixture = TestBed.createComponent(InvestmentValuationComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('formulario de valorización de inversión', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('fecha, valor y referencia tienen nombre accesible', async () => {
    await abrir();

    const controles = [...document.body.querySelectorAll('form input, form button[type=button]')].filter(
      (control) => !control.closest('fin-select') && !control.closest('footer'),
    );
    const sinNombre = controles.filter((control) => !control.getAttribute('aria-label')?.trim());

    expect(controles.length).toBeGreaterThanOrEqual(3);
    expect(sinNombre.map((control) => control.outerHTML.slice(0, 90))).toEqual([]);
  });
});
