import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardsApi, type ApiSavedDashboard, type TipoDeVista } from '@core/api';
import { RUNTIME_CONFIG } from '@core/session';
import { AppStore } from '@core/state';
import { USUARIO_DE_PRUEBA } from '@testing/usuario-de-prueba';
import { type VistaCargada, VistasGuardadasComponent } from './vistas-guardadas';
import { of, throwError } from 'rxjs';

const vista = (id: string, cambios: Partial<ApiSavedDashboard> = {}): ApiSavedDashboard =>
  ({
    id,
    name: `Vista ${id}`,
    layoutJson: `{"id":"${id}"}`,
    isMine: true,
    isPinned: false,
    sharedWith: [],
    owner: { id: 'u1', name: 'Ana' },
    ...cambios,
  }) as ApiSavedDashboard;

interface Opciones {
  vistas?: ApiSavedDashboard[];
  capacidades?: string[];
  remoto?: 'ready' | 'loading';
  tipo?: TipoDeVista;
}

function montar(opciones: Opciones = {}) {
  const guardadas = [...(opciones.vistas ?? [])];
  let contador = 0;
  const api = {
    lista: vi.fn(() => of([...guardadas])),
    una: vi.fn((_tipo: TipoDeVista, id: string) => of(guardadas.find((v) => v.id === id)!)),
    crear: vi.fn((_tipo: TipoDeVista, cuerpo: { name: string; layoutJson: string }) => {
      const creada = vista(`nueva-${++contador}`, { name: cuerpo.name, layoutJson: cuerpo.layoutJson });
      guardadas.push(creada);
      return of(creada);
    }),
    actualizar: vi.fn((_tipo: TipoDeVista, id: string, cuerpo: { name: string; layoutJson: string }) => {
      const i = guardadas.findIndex((v) => v.id === id);
      guardadas[i] = { ...guardadas[i], name: cuerpo.name, layoutJson: cuerpo.layoutJson };
      return of(guardadas[i]);
    }),
    compartirCon: vi.fn(() => of(undefined)),
    miembrosPara: vi.fn(() => of([{ id: 'u2', name: 'Beto' }])),
    borrar: vi.fn((_tipo: TipoDeVista, id: string) => {
      guardadas.splice(
        guardadas.findIndex((v) => v.id === id),
        1,
      );
      return of(undefined);
    }),
  };
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      { provide: DashboardsApi, useValue: api },
    ],
  });
  const store = TestBed.inject(AppStore);
  store.user.set({
    ...USUARIO_DE_PRUEBA,
    capabilities: opciones.capacidades ?? ['reportes.propios.crear', 'reportes.propios.accesos.editar'],
  });
  store.remoteState.set(opciones.remoto ?? 'ready');
  const fixture = TestBed.createComponent(VistasGuardadasComponent);
  fixture.componentRef.setInput('tipo', opciones.tipo ?? 'reporte');
  fixture.componentRef.setInput('estado', '{"actual":1}');
  fixture.componentRef.setInput('etiqueta', 'Reportes guardados');
  fixture.componentRef.setInput('vacia', 'Sin reporte');
  fixture.componentRef.setInput('plantillas', [{ id: 'anual', nombre: 'Anual', json: '{"plantilla":"anual"}' }]);
  const emitidas: VistaCargada[] = [];
  fixture.componentInstance.cargar.subscribe((valor) => emitidas.push(valor));
  fixture.detectChanges();
  return { fixture, componente: fixture.componentInstance, api, emitidas, store };
}

const cambiarEstado = (fixture: ReturnType<typeof montar>['fixture'], estado: string) => {
  fixture.componentRef.setInput('estado', estado);
  fixture.detectChanges();
};

describe('vistas guardadas: qué se ofrece', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('ofrece primero «sin vista», luego las plantillas, las propias y las compartidas con su dueño', async () => {
    const { componente, fixture } = montar({
      vistas: [vista('v2', { isMine: false, owner: { id: 'u9', name: 'Carla' } }), vista('v1')],
    });
    await fixture.whenStable();

    const opciones = componente.opciones();
    expect(opciones.map((o) => o.value)).toEqual(['', 'plantilla:anual', 'v1', 'v2']);
    expect(opciones[0].label).toBe('Sin reporte');
    expect(opciones[3].description).toContain('Carla');
  });

  it('una vista propia compartida muestra con cuántas personas', async () => {
    const { componente, fixture } = montar({
      vistas: [vista('v1', { sharedWith: [{ id: 'u2', name: 'Beto' }] as never })],
    });
    await fixture.whenStable();

    expect(componente.opciones().find((o) => o.value === 'v1')?.description).toContain('1');
  });

  it('mientras la sesión no está lista no pide vistas ni deja crear', () => {
    const { componente, api } = montar({ remoto: 'loading' });

    expect(api.lista).not.toHaveBeenCalled();
    expect(componente.puedeCrear()).toBe(false);
    expect(componente.puedeCompartir()).toBe(false);
  });

  it.each([
    ['reporte', 'reportes.propios.crear', 'reportes.propios.accesos.editar'],
    ['dashboard', 'dashboard.tableros.crear', 'dashboard.tableros.accesos.editar'],
    ['plan.deudas', 'planificacion.planes.crear', 'planificacion.planes.accesos.editar'],
  ] as const)('en «%s» crear y compartir piden sus propios permisos', (tipo, crear, compartir) => {
    const solo = montar({ tipo, capacidades: [crear] });
    expect(solo.componente.puedeCrear()).toBe(true);
    expect(solo.componente.puedeCompartir()).toBe(false);

    const ambos = montar({ tipo, capacidades: [crear, compartir] });
    expect(ambos.componente.puedeCompartir()).toBe(true);

    const ninguno = montar({ tipo, capacidades: [] });
    expect(ninguno.componente.puedeCrear()).toBe(false);
  });
});

describe('vistas guardadas: abrir', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('elegir «sin vista» emite nada guardado y no pide nada', async () => {
    const { componente, emitidas, api } = montar({ vistas: [vista('v1')] });

    await componente.elegir('');

    expect(emitidas).toEqual([{ json: null, soloLectura: false }]);
    expect(api.una).not.toHaveBeenCalled();
  });

  it('elegir una plantilla emite su JSON sin pedirla al servidor', async () => {
    const { componente, emitidas, api } = montar();

    await componente.elegir('plantilla:anual');

    expect(emitidas).toEqual([{ json: '{"plantilla":"anual"}', soloLectura: false }]);
    expect(api.una).not.toHaveBeenCalled();
  });

  it('abrir una vista propia emite su diseño, editable', async () => {
    const { componente, emitidas } = montar({ vistas: [vista('v1')] });

    await componente.elegir('v1');

    expect(emitidas).toEqual([{ json: '{"id":"v1"}', soloLectura: false }]);
    expect(componente.esPropia()).toBe(true);
  });

  it('abrir una vista compartida por otra persona la deja de solo lectura', async () => {
    const { componente, emitidas } = montar({ vistas: [vista('v2', { isMine: false })] });

    await componente.elegir('v2');

    expect(emitidas).toEqual([{ json: '{"id":"v2"}', soloLectura: true }]);
    expect(componente.esPropia()).toBe(false);
  });

  it('si el servidor falla al abrir muestra el error y no emite', async () => {
    const { componente, emitidas, api } = montar({ vistas: [vista('v1')] });
    api.una.mockReturnValueOnce(throwError(() => ({ error: { detail: 'La vista ya no existe.' } })));

    await componente.elegir('v1');

    expect(componente.error()).toBe('La vista ya no existe.');
    expect(emitidas).toEqual([]);
  });
});

describe('vistas guardadas: guardar y volver a abrir lo deja igual', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('crear guarda el estado actual, selecciona la nueva y al abrirla devuelve ese mismo estado', async () => {
    const { componente, api, emitidas } = montar();
    componente.abrirPanel('nuevo');
    componente.nombre.set('Mi reporte');

    await componente.confirmar();

    expect(api.crear).toHaveBeenCalledWith('reporte', { name: 'Mi reporte', layoutJson: '{"actual":1}' });
    expect(componente.seleccion()).toBe('nueva-1');
    expect(componente.panel()).toBeNull();

    await componente.elegir('nueva-1');

    expect(emitidas.at(-1)).toEqual({ json: '{"actual":1}', soloLectura: false });
  });

  it('un cambio posterior se marca como sin guardar y guardarlo lo guarda y limpia la marca', async () => {
    const { fixture, componente, api, emitidas } = montar({ vistas: [vista('v1')] });
    await componente.elegir('v1');
    fixture.detectChanges();
    expect(componente.sinGuardar()).toBe(false);

    cambiarEstado(fixture, '{"actual":2}');
    expect(componente.sinGuardar()).toBe(true);

    await componente.guardarCambios();
    expect(api.actualizar).toHaveBeenCalledWith('reporte', 'v1', {
      name: 'Vista v1',
      layoutJson: '{"actual":2}',
      isPinned: false,
    });
    expect(componente.sinGuardar()).toBe(false);

    await componente.elegir('v1');
    expect(emitidas.at(-1)?.json).toBe('{"actual":2}');
  });

  it('renombrar cambia el nombre y conserva el estado actual', async () => {
    const { componente, api } = montar({ vistas: [vista('v1')] });
    await componente.elegir('v1');
    componente.abrirPanel('renombrar');
    expect(componente.nombre()).toBe('Vista v1');
    componente.nombre.set('Reporte de octubre');

    await componente.confirmar();

    expect(api.actualizar).toHaveBeenCalledWith(
      'reporte',
      'v1',
      expect.objectContaining({ name: 'Reporte de octubre' }),
    );
    expect(componente.opciones().find((o) => o.value === 'v1')?.label).toBe('Reporte de octubre');
  });

  it('guardar cambios o renombrar una vista ajena no llama al servidor', async () => {
    const { componente, api } = montar({ vistas: [vista('v2', { isMine: false })] });
    await componente.elegir('v2');

    await componente.guardarCambios();
    componente.abrirPanel('renombrar');
    await componente.confirmar();

    expect(api.actualizar).not.toHaveBeenCalled();
  });
});

describe('vistas guardadas: compartir y borrar', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('compartir envía las personas elegidas, partiendo de con quién ya se compartía', async () => {
    const { componente, api } = montar({
      vistas: [vista('v1', { sharedWith: [{ id: 'u2', name: 'Beto' }] as never })],
    });
    await componente.elegir('v1');

    componente.abrirPanel('compartir');
    await Promise.resolve();
    expect([...componente.elegidos()]).toEqual(['u2']);
    componente.alternarMiembro('u3', true);
    componente.alternarMiembro('u2', false);
    await componente.confirmar();

    expect(api.compartirCon).toHaveBeenCalledWith('reporte', 'v1', ['u3']);
  });

  it('pulsar dos veces el mismo panel lo cierra', () => {
    const { componente } = montar();

    componente.abrirPanel('nuevo');
    expect(componente.panel()).toBe('nuevo');
    componente.abrirPanel('nuevo');

    expect(componente.panel()).toBeNull();
  });

  it('borrar quita la vista propia y vuelve a «sin vista»', async () => {
    const { componente, api, emitidas } = montar({ vistas: [vista('v1')] });
    await componente.elegir('v1');

    await componente.borrar();

    expect(api.borrar).toHaveBeenCalledWith('reporte', 'v1');
    expect(componente.opciones().map((o) => o.value)).not.toContain('v1');
    expect(componente.seleccion()).toBe('');
    expect(emitidas.at(-1)).toEqual({ json: null, soloLectura: false });
  });

  it('no se puede borrar una vista ajena', async () => {
    const { componente, api } = montar({ vistas: [vista('v2', { isMine: false })] });
    await componente.elegir('v2');

    await componente.borrar();

    expect(api.borrar).not.toHaveBeenCalled();
  });

  it('si borrar falla muestra el error y conserva la vista', async () => {
    const { componente, api } = montar({ vistas: [vista('v1')] });
    await componente.elegir('v1');
    api.borrar.mockReturnValueOnce(throwError(() => ({ error: { detail: 'No se pudo borrar.' } })));

    await componente.borrar();

    expect(componente.error()).toBe('No se pudo borrar.');
    expect(componente.opciones().map((o) => o.value)).toContain('v1');
  });
});
