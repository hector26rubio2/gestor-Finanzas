import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { TestBed } from '@angular/core/testing';
import { MovementAttributionFieldComponent } from './attribution-field';

@Component({
  imports: [FormsModule, MovementAttributionFieldComponent],
  template: `<form><fin-movement-attribution-field [model]="model" /></form>`,
})
class AnfitrionComponent {
  model: Record<string, any> = { person: '' };
}

describe('campo de responsabilidad: persona nueva al vuelo', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('crea la persona con la relación elegida y la deja seleccionada', async () => {
    const transport = new TransportFalso().responder('POST /api/v1/people', {
      body: { id: 'persona-nueva', displayName: 'Laura Gil', email: null },
    });
    const { fixture, component, store } = pruebaRender(AnfitrionComponent, {
      session: sesionDe().conCapacidad(P.personas.crear),
      data: datosDe({ people: [] }),
      transport,
    });
    await settle(fixture);
    const vista: HTMLElement = fixture.nativeElement;

    vista.querySelector<HTMLButtonElement>('button[aria-label="Nueva persona"]')!.click();
    await settle(fixture);

    const nombre = vista.querySelector<HTMLInputElement>('input[name="nuevaPersonaResponsable"]')!;
    nombre.value = 'Laura Gil';
    nombre.dispatchEvent(new Event('input'));
    await settle(fixture);

    const selector = vista.querySelector<HTMLButtonElement>('[aria-label^="Relación"]')!;
    selector.click();
    await settle(fixture);
    [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')]
      .find((item) => item.textContent?.includes('Familia'))!
      .click();
    await settle(fixture);

    const agregar = [...vista.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Agregar'),
    )!;
    agregar.click();
    await settle(fixture);
    await fixture.whenStable();

    expect(transport.peticiones[0].body).toMatchObject({ displayName: 'Laura Gil', relationship: 'Familia' });
    expect(component.model['person']).toBe('Laura Gil');
    expect(store.data().people.find((p) => p.id === 'persona-nueva')?.relationship).toBe('Familia');
  });
});
