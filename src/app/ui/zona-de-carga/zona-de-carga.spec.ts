import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TipoDeSkeleton } from '@ui/skeleton';
import { ZonaDeCargaComponent, estadoDeZona } from './zona-de-carga';

describe('estadoDeZona', () => {
  it('cargando sin datos muestra el esqueleto', () => {
    expect(estadoDeZona(true, false)).toBe('esqueleto');
  });
  it('cargando con datos conserva los datos', () => {
    expect(estadoDeZona(true, true)).toBe('datos');
  });
  it('carga terminada con datos muestra los datos', () => {
    expect(estadoDeZona(false, true)).toBe('datos');
  });
  it('carga terminada sin datos muestra el estado vacío', () => {
    expect(estadoDeZona(false, false)).toBe('vacio');
  });
});

@Component({
  imports: [ZonaDeCargaComponent],
  template: `
    <fin-zona-de-carga [cargando]="cargando()" [hayDatos]="hayDatos()" [tipo]="tipo()" [filas]="4" [columnas]="3">
      <p data-testid="datos">datos</p>
      <p finVacio data-testid="vacio">vacío</p>
    </fin-zona-de-carga>
  `,
})
class AnfitrionComponent {
  readonly cargando = signal(true);
  readonly hayDatos = signal(false);
  readonly tipo = signal<TipoDeSkeleton>('tabla');
}

function montar() {
  const fixture = TestBed.createComponent(AnfitrionComponent);
  fixture.detectChanges();
  const zona = fixture.nativeElement.querySelector('fin-zona-de-carga') as HTMLElement;
  const ver = () => {
    fixture.detectChanges();
    return {
      esqueleto: zona.querySelector('fin-skeleton'),
      datos: zona.querySelector('[data-testid=datos]'),
      vacio: zona.querySelector('[data-testid=vacio]'),
      barra: zona.querySelector('[data-testid=barra-de-zona]'),
      estado: zona.querySelector('[role=status]'),
    };
  };
  return { fixture, zona, ver, anfitrion: fixture.componentInstance };
}

describe('ZonaDeCargaComponent', () => {
  it('cargando sin datos: esqueleto con aria-busy y sin datos ni vacío', () => {
    const { zona, ver } = montar();
    const v = ver();
    expect(v.esqueleto).not.toBeNull();
    expect(v.datos).toBeNull();
    expect(v.vacio).toBeNull();
    expect(zona.getAttribute('aria-busy')).toBe('true');
  });

  it('pasa tipo, filas y columnas al esqueleto', () => {
    const { zona, anfitrion, ver } = montar();
    anfitrion.tipo.set('tabla');
    ver();
    expect(zona.querySelectorAll('[data-fila-esqueleto]').length).toBe(4);
    expect(zona.querySelectorAll('[data-celda-esqueleto]').length).toBe(4 * 3);
  });

  it('cargando con datos: datos, aria-busy, barra fina y aviso de estado sin esqueleto', () => {
    const { zona, anfitrion, ver } = montar();
    anfitrion.hayDatos.set(true);
    const v = ver();
    expect(v.datos).not.toBeNull();
    expect(v.esqueleto).toBeNull();
    expect(v.barra).not.toBeNull();
    expect(v.estado?.textContent?.trim()).toBeTruthy();
    expect(zona.getAttribute('aria-busy')).toBe('true');
  });

  it('terminada con datos: sin barra y aria-busy false', () => {
    const { zona, anfitrion, ver } = montar();
    anfitrion.hayDatos.set(true);
    anfitrion.cargando.set(false);
    const v = ver();
    expect(v.datos).not.toBeNull();
    expect(v.barra).toBeNull();
    expect(zona.getAttribute('aria-busy')).toBe('false');
  });

  it('terminada sin datos: estado vacío, sin esqueleto ni datos', () => {
    const { anfitrion, ver } = montar();
    anfitrion.cargando.set(false);
    const v = ver();
    expect(v.vacio).not.toBeNull();
    expect(v.esqueleto).toBeNull();
    expect(v.datos).toBeNull();
  });

  it('un refresco no cambia los datos por un esqueleto', () => {
    const { anfitrion, ver } = montar();
    anfitrion.hayDatos.set(true);
    anfitrion.cargando.set(false);
    ver();
    anfitrion.cargando.set(true);
    const v = ver();
    expect(v.datos).not.toBeNull();
    expect(v.esqueleto).toBeNull();
  });

  it('no roba el foco al cambiar de estado', () => {
    const { fixture, anfitrion, ver } = montar();
    const boton = document.createElement('button');
    document.body.appendChild(boton);
    boton.focus();
    anfitrion.cargando.set(false);
    ver();
    fixture.detectChanges();
    expect(document.activeElement).toBe(boton);
    boton.remove();
  });
});
