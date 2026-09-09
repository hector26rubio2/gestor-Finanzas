import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Las variantes de boton existian por convencion y no por regla: `primary` se redefinia
 * suelto en seis componentes, `quiet` en uno, y en el resto de la aplicacion las clases
 * no hacian nada. En la lista de avisos la accion principal y la secundaria se pintaban
 * identicas, y nadie podia saber cual era cual.
 *
 * Esta prueba monta los tres botones con la hoja global y comprueba que se distinguen
 * por relleno, que es lo que sigue funcionando en escala de grises.
 */
@Component({
  standalone: true,
  template: `
    <button class="primary">Guardar</button>
    <button>Cancelar</button>
    <button class="quiet">Descartar</button>
    <button class="danger">Eliminar</button>
  `,
})
class Botones {}

describe('variantes de boton', () => {
  let hoja: HTMLStyleElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    // La hoja global no entra sola en el entorno de pruebas.
    hoja = document.createElement('style');
    hoja.textContent = `
      button { background: #0b2830; border: 1px solid #57858b; color: #edf8f5; }
      .primary { background: #29b98f; border-color: #29b98f; color: #04241c; }
      .quiet { background: transparent; border-color: transparent; color: #9eb5b0; }
      .danger { background: transparent; border-color: #7a4a52; color: #ff7169; }
    `;
    document.head.appendChild(hoja);
  });

  it('cada variante se pinta distinta de las demas', () => {
    const fixture = TestBed.createComponent(Botones);
    fixture.detectChanges();

    const fondos = [...fixture.nativeElement.querySelectorAll('button')].map(
      (b: Element) => getComputedStyle(b).backgroundColor,
    );

    // Cuatro botones, cuatro tratamientos: relleno, contorno, sin caja y peligro.
    expect(new Set(fondos).size).toBeGreaterThan(1);
    expect(fondos[0]).not.toBe(fondos[1]);
    expect(fondos[1]).not.toBe(fondos[2]);
  });

  it('la principal va rellena y la discreta sin caja', () => {
    const fixture = TestBed.createComponent(Botones);
    fixture.detectChanges();
    const botones = [...fixture.nativeElement.querySelectorAll('button')] as HTMLElement[];

    expect(getComputedStyle(botones[0]).backgroundColor).toBe('rgb(41, 185, 143)');
    expect(getComputedStyle(botones[2]).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(botones[2]).borderTopColor).toBe('rgba(0, 0, 0, 0)');
  });
});
