import { DestroyRef, Injector, ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiWritesBus } from '@core/api/api-writes';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import { RecursoRemoto, crearRecursoRemoto } from './recurso-remoto';
import { AppStore } from './store';

const estabilizar = async () => {
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
};

describe('crearRecursoRemoto', () => {
  let cargar: ReturnType<typeof vi.fn<() => Observable<string[]>>>;

  function montar(opciones: { permiso?: string; capacidades?: string[] } = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test' } }],
    });
    const store = TestBed.inject(AppStore);
    store.user.set({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.test',
      capabilities: opciones.capacidades ?? ['ver'],
    } as never);
    store.organization.set({ id: 'o1', name: 'Personal' });
    store.remoteState.set('ready');
    const recurso = TestBed.runInInjectionContext(() =>
      crearRecursoRemoto<string[]>({ cargar, permiso: opciones.permiso }),
    );
    return { store, recurso, escrituras: TestBed.inject(ApiWritesBus) };
  }

  const solicitar = (recurso: RecursoRemoto<string[]>) => {
    const destruccion = TestBed.inject(Injector).get(DestroyRef);
    recurso.solicitar(destruccion);
    return destruccion;
  };

  beforeEach(() => {
    cargar = vi.fn(() => of(['a']));
  });

  it('no pide nada hasta que alguien lo solicita', async () => {
    const { recurso } = montar();
    await estabilizar();

    expect(cargar).not.toHaveBeenCalled();
    expect(recurso.estado()).toBe('inactivo');
    expect(recurso.valor()).toBeUndefined();
  });

  it('carga una sola vez al solicitarlo y queda listo', async () => {
    const { recurso } = montar();

    solicitar(recurso);
    await estabilizar();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(recurso.estado()).toBe('listo');
    expect(recurso.valor()).toEqual(['a']);
  });

  it('expone el error y permite reintentar', async () => {
    cargar.mockReturnValueOnce(throwError(() => new Error('sin red')));
    const { recurso } = montar();

    solicitar(recurso);
    await estabilizar();
    expect(recurso.estado()).toBe('error');
    expect(recurso.valor()).toBeUndefined();

    recurso.recargar();
    await estabilizar();
    expect(recurso.estado()).toBe('listo');
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('recarga tras una escritura mientras alguien lo usa', async () => {
    const { recurso, escrituras } = montar();
    solicitar(recurso);
    await estabilizar();

    escrituras.notify();
    await estabilizar();

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('sin usuarios la escritura solo lo marca y recarga al volver a solicitarlo', async () => {
    const { recurso, escrituras } = montar();
    const destruccion = solicitar(recurso);
    await estabilizar();
    recurso.soltar(destruccion);

    escrituras.notify();
    await estabilizar();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(recurso.valor()).toEqual(['a']);

    solicitar(recurso);
    await estabilizar();
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('conserva la caché al volver a solicitarlo sin escrituras', async () => {
    const { recurso } = montar();
    const destruccion = solicitar(recurso);
    await estabilizar();
    recurso.soltar(destruccion);

    solicitar(recurso);
    await estabilizar();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(recurso.valor()).toEqual(['a']);
  });

  it('descarta la caché al cambiar de organización y no pide hasta que se solicite', async () => {
    const { store, recurso } = montar();
    const destruccion = solicitar(recurso);
    await estabilizar();
    recurso.soltar(destruccion);

    store.organization.set({ id: 'o2', name: 'Otra' });
    await estabilizar();
    expect(recurso.valor()).toBeUndefined();
    expect(cargar).toHaveBeenCalledTimes(1);

    solicitar(recurso);
    await estabilizar();
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('no pide sin el permiso exigido', async () => {
    const { recurso } = montar({ permiso: 'deudas.listar', capacidades: ['ver'] });

    solicitar(recurso);
    await estabilizar();

    expect(cargar).not.toHaveBeenCalled();
    expect(recurso.estado()).toBe('inactivo');
  });

  it('pide con el permiso y se vacía al cerrar la sesión', async () => {
    const { store, recurso } = montar({ permiso: 'deudas.listar', capacidades: ['deudas.listar'] });
    solicitar(recurso);
    await estabilizar();
    expect(recurso.valor()).toEqual(['a']);

    store.remoteState.set('anonymous');
    await estabilizar();

    expect(recurso.valor()).toBeUndefined();
  });

  it('actualizar cambia el valor cargado sin pedir de nuevo', async () => {
    const { recurso } = montar();
    solicitar(recurso);
    await estabilizar();

    recurso.actualizar((valor) => [...valor, 'b']);

    expect(recurso.valor()).toEqual(['a', 'b']);
    expect(cargar).toHaveBeenCalledTimes(1);
  });
});
