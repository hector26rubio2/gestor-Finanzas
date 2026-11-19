import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { MovementAttributionFieldComponent } from './attribution-field';

@Component({
  imports: [FormsModule, MovementAttributionFieldComponent],
  template: `<form><fin-movement-attribution-field [model]="model" /></form>`,
})
class Anfitrion {
  model: Record<string, any> = { person: '' };
}

const nueva = { id: 'persona-nueva', displayName: 'Laura Gil', email: null };

function montar(capacidades: string[], transport = new TransportFalso()) {
  const montado = pruebaRender(Anfitrion, {
    session: sesionDe().conCapacidad(...capacidades),
    data: datosDe({ people: [] }),
    transport,
  });
  montado.cambios();
  const campo = montado.fixture.debugElement.query(By.directive(MovementAttributionFieldComponent))
    .componentInstance as MovementAttributionFieldComponent;
  return { ...montado, campo, transport };
}

describe('campo de responsabilidad: casos de la persona nueva', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin permiso de crear personas no ofrece crear una', () => {
    const { fixture } = montar([]);

    expect(fixture.nativeElement.querySelector('button[aria-label="Nueva persona"]')).toBeNull();
  });

  it('con permiso ofrece crear una', () => {
    const { fixture } = montar([P.personas.crear]);

    expect(fixture.nativeElement.querySelector('button[aria-label="Nueva persona"]')).not.toBeNull();
  });

  it('sin elegir relación se guarda con la relación por defecto', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', { body: nueva });
    const { campo, component } = montar([P.personas.crear], transport);
    campo.nombreNuevo.set('Laura Gil');

    await campo.agregar();

    expect(transport.peticiones[0].body).toMatchObject({ displayName: 'Laura Gil', relationship: 'Otro' });
    expect(component.model['person']).toBe('Laura Gil');
  });

  it('un nombre vacío no llama a la API ni cambia la selección', async () => {
    const { campo, component, transport } = montar([P.personas.crear]);
    campo.nombreNuevo.set('   ');

    await campo.agregar();

    expect(transport.peticiones).toEqual([]);
    expect(component.model['person']).toBe('');
  });

  it('al terminar limpia el formulario y lo cierra', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', { body: nueva });
    const { campo } = montar([P.personas.crear], transport);
    campo.creando.set(true);
    campo.nombreNuevo.set('Laura Gil');
    campo.relacionNueva.set('Trabajo');

    await campo.agregar();

    expect(campo.creando()).toBe(false);
    expect(campo.nombreNuevo()).toBe('');
    expect(campo.relacionNueva()).toBe('Otro');
    expect(campo.guardando()).toBe(false);
  });

  it('si la API falla no deja a la persona elegida y permite reintentar', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', { error: { status: 500 } });
    const { campo, component } = montar([P.personas.crear], transport);
    campo.creando.set(true);
    campo.nombreNuevo.set('Laura Gil');

    await expect(campo.agregar()).rejects.toBeDefined();

    expect(component.model['person']).toBe('');
    expect(campo.creando()).toBe(true);
    expect(campo.nombreNuevo()).toBe('Laura Gil');
    expect(campo.guardando()).toBe(false);
  });
});
