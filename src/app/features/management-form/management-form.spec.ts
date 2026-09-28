import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore, CatalogCommands } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { ManagementFormComponent } from './management-form';

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
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.personas.ver, P.personas.crear] });
  store.form.set({ kind: 'person' });
  const fixture = TestBed.createComponent(ManagementFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const refrescar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { componente: fixture.componentInstance, refrescar };
}

describe('formulario de persona o entidad', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una persona pide correo y una entidad no', async () => {
    const { componente, refrescar } = await abrir();
    expect(document.body.querySelector('input[name="email"]')).not.toBeNull();

    componente.elegirTipoDePersona('institution');
    await refrescar();

    expect(document.body.querySelector('input[name="email"]')).toBeNull();
    expect(document.body.querySelector('fin-segmented')).not.toBeNull();
  });

  it('una entidad se guarda sin correo aunque se hubiera escrito uno', async () => {
    const { componente } = await abrir();
    const createPerson = vi.spyOn(TestBed.inject(CatalogCommands), 'createPerson').mockResolvedValue(undefined);
    componente.name = 'Banco Uno';
    componente.email = 'algo@banco.test';
    componente.elegirTipoDePersona('institution');

    await componente.save();

    expect(createPerson).toHaveBeenCalledWith('Banco Uno', '', expect.anything(), 'institution');
  });
});
