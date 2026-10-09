import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HeaderActionsService } from './header-actions.service';

describe('acciones del encabezado', () => {
  const servicio = () => TestBed.inject(HeaderActionsService);

  it('marcar todas está deshabilitado sin notificaciones por leer', () => {
    const acciones = servicio();
    acciones.readAll.set(() => undefined);
    acciones.sinLeer.set(0);
    expect(acciones.puedeMarcarTodas()).toBe(false);
  });

  it('se habilita cuando hay notificaciones por leer', () => {
    const acciones = servicio();
    acciones.readAll.set(() => undefined);
    acciones.sinLeer.set(3);
    expect(acciones.puedeMarcarTodas()).toBe(true);
  });

  it('sin acción registrada sigue deshabilitado', () => {
    const acciones = servicio();
    acciones.sinLeer.set(3);
    expect(acciones.puedeMarcarTodas()).toBe(false);
  });
});
