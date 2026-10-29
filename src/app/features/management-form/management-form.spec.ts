import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '@core/api';
import { P, RUNTIME_CONFIG } from '@core/session';
import { AppStore, CatalogCommands } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { ManagementFormComponent } from './management-form';

async function abrir(kind: 'person' | 'recurrence' | 'investment' = 'person', targetId?: string) {
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
  store.user.set({
    ...USUARIO_DE_PRUEBA,
    capabilities: [
      P.personas.ver,
      P.personas.crear,
      P.calendario.recurrencias.crear,
      P.patrimonio.inversiones.crear,
      P.patrimonio.inversiones.editar,
    ],
  });
  store.form.set({ kind, targetId });
  const fixture = TestBed.createComponent(ManagementFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const refrescar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, componente: fixture.componentInstance, refrescar };
}

async function escribir(fixture: ComponentFixture<ManagementFormComponent>, nombre: string, valor: string) {
  const campo = document.body.querySelector<HTMLInputElement>(`input[name="gestion.${nombre}"]`)!;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  await fixture.whenStable();
}

async function enviar(fixture: ComponentFixture<ManagementFormComponent>) {
  document.body.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('formulario de persona o entidad', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('una persona pide correo y una entidad no', async () => {
    const { componente, refrescar } = await abrir();
    expect(document.body.querySelector('input[name="gestion.email"]')).not.toBeNull();

    componente.elegirTipoDePersona('institution');
    await refrescar();

    expect(document.body.querySelector('input[name="gestion.email"]')).toBeNull();
    expect(document.body.querySelector('fin-segmented')).not.toBeNull();
  });

  it('una entidad se guarda sin correo aunque se hubiera escrito uno', async () => {
    const { componente } = await abrir();
    const createPerson = vi.spyOn(TestBed.inject(CatalogCommands), 'createPerson').mockResolvedValue(undefined);
    componente.modelo.update((datos) => ({ ...datos, name: 'Banco Uno', email: 'algo@banco.test' }));
    componente.elegirTipoDePersona('institution');

    await componente.save();

    expect(createPerson).toHaveBeenCalledWith('Banco Uno', '', expect.anything(), 'institution');
  });

  it('un nombre vacío muestra el error en el campo y no guarda', async () => {
    const { fixture } = await abrir();
    const createPerson = vi.spyOn(TestBed.inject(CatalogCommands), 'createPerson').mockResolvedValue(undefined);

    await escribir(fixture, 'name', '   ');
    await enviar(fixture);

    expect(createPerson).not.toHaveBeenCalled();
    expect(document.body.querySelector('input[name="gestion.name"]')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.querySelector('[role=alert]')?.textContent).toContain('El nombre es obligatorio.');
  });

  it('un correo mal escrito bloquea el envío y uno vacío no', async () => {
    const { fixture } = await abrir();
    const createPerson = vi.spyOn(TestBed.inject(CatalogCommands), 'createPerson').mockResolvedValue(undefined);
    await escribir(fixture, 'name', 'Ana');

    await escribir(fixture, 'email', 'ana-sin-arroba');
    await enviar(fixture);
    expect(createPerson).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Escribe un correo válido.');

    await escribir(fixture, 'email', '');
    await enviar(fixture);
    expect(createPerson).toHaveBeenCalledOnce();
  });
});

describe('formulario de recurrencia', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('exige monto positivo y una cuenta válida antes de guardar', async () => {
    const { fixture } = await abrir('recurrence');
    const createRecurrence = vi.spyOn(TestBed.inject(CatalogCommands), 'createRecurrence').mockResolvedValue(undefined);

    await escribir(fixture, 'name', 'Arriendo');
    await escribir(fixture, 'amount', '0');
    await enviar(fixture);

    expect(createRecurrence).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('El monto debe ser mayor a 0.');
    expect(document.body.textContent).toContain('Selecciona una cuenta válida.');
  });
});

describe('formulario de inversión', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('el campo Nombre tiene nombre accesible', async () => {
    await abrir('investment');

    expect(document.body.querySelector('input[name="gestion.name"]')?.getAttribute('aria-label')).toBe('Nombre');
  });

  it('crear envía riesgo, símbolo e institución', async () => {
    const { componente } = await abrir('investment');
    const createInvestment = vi.spyOn(TestBed.inject(CatalogCommands), 'createInvestment').mockResolvedValue(undefined);
    expect(document.body.querySelector('input[name="gestion.symbol"]')).not.toBeNull();
    expect(document.body.querySelector('input[name="gestion.institution"]')).not.toBeNull();
    componente.modelo.update((datos) => ({
      ...datos,
      name: 'ETF',
      risk: '3',
      symbol: 'VOO',
      institution: 'Broker',
      currency: 'USD',
    }));

    await componente.save();

    expect(createInvestment).toHaveBeenCalledWith('ETF', 'CDT', 'USD', {
      risk: 3,
      symbol: 'VOO',
      institution: 'Broker',
    });
  });

  it('editar precarga instrumento, riesgo y símbolo y los guarda', async () => {
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
    store.user.set({ ...USUARIO_DE_PRUEBA, capabilities: [P.patrimonio.inversiones.editar] });
    store.data.update((data) => ({
      ...data,
      investments: [
        {
          id: 'i1',
          name: 'Fondo',
          type: 'Fondo',
          cost: 1,
          value: 1,
          currency: 'COP',
          risk: 'Alto',
          symbol: 'FND',
          netContributions: 0,
          sinValoracion: true,
        },
      ],
    }));
    store.form.set({ kind: 'investment', targetId: 'i1' });
    const updateInvestment = vi.spyOn(TestBed.inject(CatalogCommands), 'updateInvestment').mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(ManagementFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.modelo()).toMatchObject({ instrument: 'Fondo', risk: '3', symbol: 'FND' });

    await fixture.componentInstance.save();

    expect(updateInvestment).toHaveBeenCalledWith('i1', {
      name: 'Fondo',
      instrumentType: 'Fondo',
      risk: 3,
      symbol: 'FND',
    });
  });

  it('los campos de inversión tienen nombre accesible', async () => {
    await abrir('investment');

    const sinNombre = [...document.body.querySelectorAll('form input')].filter(
      (control) => !control.closest('fin-select') && !control.getAttribute('aria-label')?.trim(),
    );

    expect(sinNombre.map((control) => control.outerHTML.slice(0, 90))).toEqual([]);
  });
});
