import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore, CatalogCommands } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { ManagementFormComponent } from './management-form';

async function abrirEdicion(capacidades: string[] = [P.personas.ver, P.personas.editar]) {
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
  store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: capacidades });
  datosDe({
    people: [{ id: 'p1', name: 'Camilo', owed: 0, owing: 0, email: 'c@test.dev', relationship: 'Amistad' }],
  }).aplicarEn(store);
  store.form.set({ kind: 'person', targetId: 'p1' });
  const fixture = TestBed.createComponent(ManagementFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, componente: fixture.componentInstance };
}

describe('formulario al editar una persona', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('abre con el nombre, el correo y la relación actuales', async () => {
    const { componente } = await abrirEdicion();

    expect(componente.modelo()).toMatchObject({ name: 'Camilo', email: 'c@test.dev', relationship: 'Amistad' });
  });

  it('al guardar envía el nombre y la relación cambiados a updatePerson', async () => {
    const { componente } = await abrirEdicion();
    const actualizar = vi.spyOn(TestBed.inject(CatalogCommands), 'updatePerson').mockResolvedValue(undefined);
    componente.modelo.update((datos) => ({ ...datos, name: 'Camilo Rojas', relationship: 'Trabajo' }));

    await componente.save();

    expect(actualizar).toHaveBeenCalledOnce();
    expect(actualizar.mock.calls[0][0]).toBe('p1');
    expect(actualizar.mock.calls[0][1]).toMatchObject({ name: 'Camilo Rojas', relationship: 'Trabajo' });
  });

  it('sin permiso de editar personas no guarda y lo dice', async () => {
    const { componente } = await abrirEdicion([P.personas.ver]);
    const actualizar = vi.spyOn(TestBed.inject(CatalogCommands), 'updatePerson').mockResolvedValue(undefined);

    await componente.save();

    expect(actualizar).not.toHaveBeenCalled();
    expect(componente.error()).not.toBe('');
  });
});
