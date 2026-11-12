import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Pantalla, TamanoDePantalla } from '@ui/pantalla';
import { DetalleComponent } from './detalle';
import { ListaYDetalleComponent, contenedorDeDetalle } from './lista-y-detalle';

describe('contenedorDeDetalle', () => {
  it.each<[TamanoDePantalla, boolean, string]>([
    ['amplio', true, 'acoplado'],
    ['amplio', false, 'superpuesto'],
    ['compacto', true, 'superpuesto'],
    ['medio', true, 'superpuesto'],
    ['expandido', true, 'acoplado'],
    ['expandido', false, 'superpuesto'],
  ])('en %s con habilitado=%s usa %s', (tamano, habilitado, esperado) => {
    expect(contenedorDeDetalle(tamano, habilitado)).toBe(esperado);
  });
});

@Component({
  imports: [ListaYDetalleComponent, DetalleComponent],
  template: `
    <fin-lista-y-detalle [habilitado]="habilitado()">
      <p data-testid="lista">lista</p>
      @if (abierto()) {
        <fin-detalle [titulo]="titulo()" [acoplable]="acoplable()" (cerrado)="cerrar()">
          <button data-testid="accion" type="button">accion</button>
          <p data-testid="contenido">{{ titulo() }}</p>
        </fin-detalle>
      }
    </fin-lista-y-detalle>
  `,
})
class Anfitrion {
  habilitado = signal(true);
  abierto = signal(false);
  acoplable = signal(true);
  titulo = signal('Movimiento A');
  cierres = 0;
  cerrar() {
    this.cierres++;
    this.abierto.set(false);
  }
}

function montar(tamano: TamanoDePantalla) {
  TestBed.configureTestingModule({
    providers: [{ provide: Pantalla, useValue: { tamano: signal(tamano) } }],
  });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    raiz,
    anfitrion: fixture.componentInstance,
    panel: () => raiz.querySelector<HTMLElement>('aside[role=complementary]'),
    superpuesto: () => raiz.querySelector('fin-overlay'),
  };
}

describe('lista y detalle', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('en amplio el detalle queda acoplado como región complementary con nombre y sin telón', () => {
    const { fixture, anfitrion, panel, superpuesto, raiz } = montar('amplio');
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    expect(panel()).not.toBeNull();
    expect(panel()!.getAttribute('aria-label')).toBe('Movimiento A');
    expect(panel()!.getAttribute('aria-modal')).toBeNull();
    expect(superpuesto()).toBeNull();
    expect(raiz.querySelector('[data-testid=lista]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid=contenido]')!.textContent).toBe('Movimiento A');
  });

  it('en amplio sin detalle abierto no hay panel', () => {
    const { panel } = montar('amplio');
    expect(panel()).toBeNull();
  });

  it.each<TamanoDePantalla>(['compacto', 'medio'])('en %s usa el contenedor superpuesto', (tamano) => {
    const { fixture, anfitrion, panel, superpuesto } = montar(tamano);
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(superpuesto()).not.toBeNull();
  });

  it('si el detalle no es acoplable usa el contenedor superpuesto aun en amplio', () => {
    const { fixture, anfitrion, panel, superpuesto } = montar('amplio');
    anfitrion.acoplable.set(false);
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(superpuesto()).not.toBeNull();
  });

  it('si la lista no lo habilita usa el contenedor superpuesto aun en amplio', () => {
    const { fixture, anfitrion, panel, superpuesto } = montar('amplio');
    anfitrion.habilitado.set(false);
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(superpuesto()).not.toBeNull();
  });

  it('cambiar el contenido no cierra ni recrea el panel', () => {
    const { fixture, anfitrion, panel, raiz } = montar('amplio');
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    const original = panel();
    anfitrion.titulo.set('Movimiento B');
    fixture.detectChanges();
    expect(panel()).toBe(original);
    expect(panel()!.getAttribute('aria-label')).toBe('Movimiento B');
    expect(raiz.querySelector('[data-testid=contenido]')!.textContent).toBe('Movimiento B');
    expect(anfitrion.cierres).toBe(0);
  });

  it('el botón cierra el detalle', () => {
    const { fixture, anfitrion, panel } = montar('amplio');
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    panel()!.querySelector<HTMLButtonElement>('button[data-cerrar-detalle]')!.click();
    fixture.detectChanges();
    expect(anfitrion.cierres).toBe(1);
    expect(panel()).toBeNull();
  });

  it('Escape dentro del panel cierra el detalle', () => {
    const { fixture, anfitrion, panel } = montar('amplio');
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(anfitrion.cierres).toBe(1);
    expect(panel()).toBeNull();
  });

  it('Escape en el documento cierra el detalle acoplado', () => {
    const { fixture, anfitrion, panel } = montar('amplio');
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(anfitrion.cierres).toBe(1);
    expect(panel()).toBeNull();
  });
});
