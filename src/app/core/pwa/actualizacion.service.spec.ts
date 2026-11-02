import { TestBed } from '@angular/core/testing';
import { SwUpdate, type UnrecoverableStateEvent, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActualizacionPwa, RECARGAR_PAGINA } from './actualizacion.service';

describe('actualización de la PWA', () => {
  let versiones: Subject<VersionEvent>;
  let irrecuperable: Subject<UnrecoverableStateEvent>;
  let activar: ReturnType<typeof vi.fn>;
  let recargar: ReturnType<typeof vi.fn>;
  let habilitado: boolean;

  const crear = () => {
    const servicio = TestBed.inject(ActualizacionPwa);
    servicio.iniciar();
    return servicio;
  };

  beforeEach(() => {
    versiones = new Subject();
    irrecuperable = new Subject();
    activar = vi.fn().mockResolvedValue(true);
    recargar = vi.fn();
    habilitado = true;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            get isEnabled() {
              return habilitado;
            },
            versionUpdates: versiones,
            unrecoverable: irrecuperable,
            activateUpdate: activar,
          },
        },
        { provide: RECARGAR_PAGINA, useValue: recargar },
      ],
    });
  });

  it('avisa cuando hay una versión lista', () => {
    const servicio = crear();
    expect(servicio.versionNueva()).toBe(false);
    versiones.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    expect(servicio.versionNueva()).toBe(true);
  });

  it('ignora eventos que no son de versión lista', () => {
    const servicio = crear();
    versiones.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(servicio.versionNueva()).toBe(false);
  });

  it('al aceptar activa la versión y recarga', async () => {
    const servicio = crear();
    await servicio.actualizar();
    expect(activar).toHaveBeenCalledOnce();
    expect(recargar).toHaveBeenCalledOnce();
  });

  it('marca fallo cuando la instalación de la versión falla', () => {
    const servicio = crear();
    versiones.next({ type: 'VERSION_INSTALLATION_FAILED', version: { hash: 'b' }, error: 'boom' });
    expect(servicio.falloDeInstalacion()).toBe(true);
    expect(servicio.versionNueva()).toBe(false);
  });

  it('recarga ante un estado irrecuperable', () => {
    crear();
    irrecuperable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });
    expect(recargar).toHaveBeenCalledOnce();
  });

  it('si activar falla igual recarga', async () => {
    activar.mockRejectedValue(new Error('x'));
    const servicio = crear();
    await servicio.actualizar();
    expect(recargar).toHaveBeenCalledOnce();
  });

  it('no escucha nada si el service worker está deshabilitado', () => {
    habilitado = false;
    const servicio = crear();
    versiones.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    irrecuperable.next({ type: 'UNRECOVERABLE_STATE', reason: 'x' });
    expect(servicio.versionNueva()).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
  });
});
