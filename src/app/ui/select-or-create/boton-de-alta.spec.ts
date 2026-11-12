import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonDeAltaComponent, CancelarConEscape } from './boton-de-alta';

const cancelado = vi.fn();

@Component({
  imports: [BotonDeAltaComponent, CancelarConEscape],
  template: `
    <fin-boton-de-alta etiqueta="Añadir categoría" [abierto]="abierto()" (alternar)="abierto.set(!abierto())" />
    @if (abierto()) {
      <div finCancelarConEscape (cancelar)="abierto.set(false); cancelado()"><input name="nuevo" /></div>
    }
  `,
})
class Anfitrion {
  readonly abierto = signal(false);
  readonly cancelado = cancelado;
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  return fixture;
}

const boton = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.querySelector('button')!;

describe('botón de alta en línea', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    cancelado.mockClear();
  });

  it('cerrado muestra «+» con el nombre de añadir', () => {
    const fixture = montar();

    expect(boton(fixture).getAttribute('aria-label')).toBe('Añadir categoría');
    expect(boton(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(boton(fixture).querySelector('fin-icon')?.getAttribute('name')).toBe('plus');
  });

  it('abierto muestra «X» con el nombre «Cancelar» y sigue anunciando que está expandido', () => {
    const fixture = montar();

    boton(fixture).click();
    fixture.detectChanges();

    expect(boton(fixture).getAttribute('aria-label')).toBe('Cancelar');
    expect(boton(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(boton(fixture).querySelector('fin-icon')?.getAttribute('name')).toBe('close');
  });

  it('pulsarlo otra vez cancela y vuelve a «+»', () => {
    const fixture = montar();

    boton(fixture).click();
    fixture.detectChanges();
    boton(fixture).click();
    fixture.detectChanges();

    expect(boton(fixture).getAttribute('aria-label')).toBe('Añadir categoría');
    expect(boton(fixture).querySelector('fin-icon')?.getAttribute('name')).toBe('plus');
  });

  it('Escape dentro del alta la cancela sin dejar que el evento siga hacia el formulario', () => {
    const fixture = montar();
    boton(fixture).click();
    fixture.detectChanges();
    const alcanzaElFormulario = vi.fn();
    document.body.addEventListener('keydown', alcanzaElFormulario);

    const evento = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('input').dispatchEvent(evento);
    fixture.detectChanges();
    document.body.removeEventListener('keydown', alcanzaElFormulario);

    expect(cancelado).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
    expect(alcanzaElFormulario).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(boton(fixture).getAttribute('aria-label')).toBe('Añadir categoría');
  });
});
