import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pantalla, TamanoDePantalla } from '@ui/pantalla';
import { FinAcciones, OverlayComponent } from './index';

const cerrado = vi.fn();

@Component({
  imports: [OverlayComponent, FinAcciones],
  template: `
    <fin-overlay title="Nuevo movimiento" [mode]="modo()" (closed)="cerrado()">
      <form id="formulario-de-prueba"><input name="campo" /></form>
      <footer finAcciones>
        <button type="button">Cancelar</button>
        <button type="submit" form="formulario-de-prueba">Guardar</button>
      </footer>
    </fin-overlay>
  `,
})
class Anfitrion {
  readonly modo = signal<'modal' | 'formulario' | 'inspector'>('formulario');
  readonly cerrado = cerrado;
}

async function abrir(tamano: TamanoDePantalla, modo: 'modal' | 'formulario' | 'inspector' = 'formulario') {
  TestBed.configureTestingModule({ providers: [{ provide: Pantalla, useValue: { tamano: signal(tamano) } }] });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.componentInstance.modo.set(modo);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

const superficie = () => document.body.querySelector<HTMLElement>('[data-superficie]');

describe('fin-overlay en modo formulario', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    cerrado.mockClear();
    document.body.querySelectorAll('.cdk-overlay-container *').forEach((nodo) => nodo.remove());
  });

  it.each<TamanoDePantalla>(['medio', 'amplio'])('en %s se abre como hoja lateral', async (tamano) => {
    await abrir(tamano);
    expect(superficie()?.dataset['superficie']).toBe('hoja');
    expect(superficie()?.getAttribute('data-slot')).toBe('sheet-content');
    expect(superficie()?.closest('[role=dialog]')).not.toBeNull();
  });

  it('en expandido sigue siendo diálogo centrado', async () => {
    await abrir('expandido');
    expect(superficie()?.dataset['superficie']).toBe('dialogo');
    expect(superficie()?.getAttribute('data-slot')).toBe('dialog-content');
  });

  it('en compacto se abre como hoja inferior al 90 % de la pantalla', async () => {
    await abrir('compacto');
    const hoja = superficie()!;
    expect(hoja.dataset['superficie']).toBe('hoja');
    expect(hoja.getAttribute('data-side')).toBe('bottom');
    expect(hoja.style.height).toBe('90dvh');
    expect(hoja.style.width).toBe('');
    expect(hoja.querySelector('[data-slot=cuerpo-de-hoja]')).not.toBeNull();
  });

  it.each<TamanoDePantalla>(['medio', 'amplio'])('en %s la hoja entra por la derecha', async (tamano) => {
    await abrir(tamano);
    expect(superficie()?.getAttribute('data-side')).toBe('right');
    expect(superficie()?.style.height).toBe('');
  });

  it('un modal común no cambia en tableta', async () => {
    await abrir('medio', 'modal');
    expect(superficie()?.dataset['superficie']).toBe('dialogo');
  });

  it('la hoja es de ancho fijo: no ofrece agarradera para cambiar el ancho', async () => {
    await abrir('medio');
    expect(superficie()?.querySelector('[role=separator]')).toBeNull();
  });

  it('la hoja lleva título, cerrar y barra de acciones con Guardar y Cancelar', async () => {
    await abrir('amplio');
    const hoja = superficie()!;
    expect(hoja.querySelector('h2')?.textContent).toContain('Nuevo movimiento');
    expect(hoja.querySelector('button[aria-label]')).not.toBeNull();
    const barra = hoja.querySelector('footer[finAcciones]');
    expect(barra).not.toBeNull();
    expect(barra?.textContent).toContain('Guardar');
    expect(barra?.textContent).toContain('Cancelar');
  });

  it('la hoja reserva espacio al pie del cuerpo desplazable para la barra de acciones', async () => {
    await abrir('amplio');
    const cuerpo = superficie()!.querySelector<HTMLElement>('[data-slot=cuerpo-de-hoja]');
    expect(cuerpo?.className).toContain('overflow-y-auto');
    expect(cuerpo?.className).toContain('pb-[calc(6rem+env(safe-area-inset-bottom))]');
    expect(cuerpo?.querySelector('footer[finAcciones]')).not.toBeNull();
  });

  it('Escape cierra la hoja', async () => {
    await abrir('medio');
    superficie()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cerrado).toHaveBeenCalledTimes(1);
  });

  it('el botón de cerrar emite el cierre', async () => {
    await abrir('medio');
    superficie()!.querySelector<HTMLButtonElement>('header button')!.click();
    expect(cerrado).toHaveBeenCalledTimes(1);
  });
});
