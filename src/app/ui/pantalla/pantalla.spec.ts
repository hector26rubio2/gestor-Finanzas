import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Pantalla, TamanoDePantalla, esTableta } from './pantalla';

class PantallaFalsa {
  ancho = 1400;
  oyentes = new Map<string, Set<() => void>>();
  matchMedia = (consulta: string) => {
    const minimo = Number(/min-width:\s*(\d+)px/.exec(consulta)?.[1] ?? 0);
    const oyentes = this.oyentes;
    const anchoActual = () => this.ancho;
    return {
      get matches() {
        return anchoActual() >= minimo;
      },
      media: consulta,
      addEventListener: (_: string, oyente: () => void) => {
        oyentes.set(consulta, (oyentes.get(consulta) ?? new Set()).add(oyente));
      },
      removeEventListener: (_: string, oyente: () => void) => oyentes.get(consulta)?.delete(oyente),
    };
  };
  mover(ancho: number) {
    this.ancho = ancho;
    this.oyentes.forEach((grupo) => grupo.forEach((oyente) => oyente()));
  }
  oyentesVivos() {
    return [...this.oyentes.values()].reduce((suma, grupo) => suma + grupo.size, 0);
  }
}

function crear(vista: unknown) {
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView: vista } }] });
  return TestBed.inject(Pantalla);
}

describe('Pantalla', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each<[number, TamanoDePantalla]>([
    [375, 'compacto'],
    [599, 'compacto'],
    [600, 'medio'],
    [768, 'medio'],
    [1023, 'medio'],
    [1024, 'amplio'],
    [1279, 'amplio'],
    [1280, 'expandido'],
    [1920, 'expandido'],
  ])('a %ipx el tamaño es %s', (ancho, esperado) => {
    const falsa = new PantallaFalsa();
    falsa.ancho = ancho;
    expect(crear(falsa).tamano()).toBe(esperado);
  });

  it('cambia en caliente cuando cambia el ancho', () => {
    const falsa = new PantallaFalsa();
    const pantalla = crear(falsa);
    expect(pantalla.tamano()).toBe('expandido');
    falsa.mover(800);
    expect(pantalla.tamano()).toBe('medio');
    falsa.mover(1100);
    expect(pantalla.tamano()).toBe('amplio');
    falsa.mover(400);
    expect(pantalla.tamano()).toBe('compacto');
  });

  it('sin matchMedia asume expandido y no falla', () => {
    expect(crear({}).tamano()).toBe('expandido');
  });

  it('sin ventana asume expandido', () => {
    expect(crear(null).tamano()).toBe('expandido');
  });

  it('al destruirse no deja oyentes', () => {
    const falsa = new PantallaFalsa();
    crear(falsa);
    expect(falsa.oyentesVivos()).toBeGreaterThan(0);
    TestBed.resetTestingModule();
    expect(falsa.oyentesVivos()).toBe(0);
  });

  it('esTableta cubre medio y amplio', () => {
    expect(['compacto', 'medio', 'amplio', 'expandido'].map((t) => esTableta(t as TamanoDePantalla))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});
