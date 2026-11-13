import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Pantalla, TamanoDePantalla } from '@ui/pantalla';
import { KpiGridComponent } from './kpi-grid';

@Component({
  imports: [KpiGridComponent],
  template: `<fin-kpi-grid
    ><div>uno</div>
    <div>dos</div></fin-kpi-grid
  >`,
})
class Anfitrion {}

function rejilla(tamano: TamanoDePantalla): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: Pantalla, useValue: { tamano: signal(tamano) } }] });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('fin-kpi-grid') as HTMLElement;
}

describe('rejilla de indicadores', () => {
  it('en teléfono es una franja horizontal desplazable, con nombre y alcanzable con el teclado', () => {
    const franja = rejilla('compacto');
    expect(franja.classList).toContain('compacto:overflow-x-auto');
    expect(franja.classList).toContain('compacto:flex-nowrap');
    expect(franja.getAttribute('role')).toBe('group');
    expect(franja.getAttribute('aria-label')).toBeTruthy();
    expect(franja.getAttribute('tabindex')).toBe('0');
  });

  it.each<TamanoDePantalla>(['medio', 'amplio', 'expandido'])('en %s no es una parada de teclado', (tamano) => {
    expect(rejilla(tamano).hasAttribute('tabindex')).toBe(false);
  });
});
