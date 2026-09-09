import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { sincronizarConLaUrl, sincronizarPaginaConLaUrl } from './url-state';

/**
 * Los filtros vivían solo en señales: una vista no se podía compartir, recargar la
 * perdía y volver de una ficha devolvía la lista sin filtrar.
 */
@Component({ standalone: true, template: '' })
class Anfitrion {
  readonly tipo = signal('all');
  readonly pagina = signal(0);
  constructor() {
    sincronizarConLaUrl('tipo', this.tipo, 'all', (v) => ['all', 'credit', 'savings'].includes(v));
    sincronizarPaginaConLaUrl(() => 'pagina', this.pagina);
  }
}

describe('estado en la URL', () => {
  function montar() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    return { fixture: TestBed.createComponent(Anfitrion), router: TestBed.inject(Router) };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('un cambio de filtro queda en la URL, para poder compartirla', async () => {
    const { fixture, router } = montar();
    fixture.detectChanges();

    fixture.componentInstance.tipo.set('credit');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toContain('tipo=credit');
  });

  it('el valor por defecto no ensucia la URL', async () => {
    const { fixture, router } = montar();
    fixture.componentInstance.tipo.set('credit');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.tipo.set('all');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).not.toContain('tipo=');
  });

  it('abrir un enlace con filtro aplica ese filtro', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?tipo=savings');

    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.tipo()).toBe('savings');
  });

  it('un valor inventado en la URL se ignora en vez de romper la vista', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    await TestBed.inject(Router).navigateByUrl('/?tipo=teletransporte');

    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.tipo()).toBe('all');
  });

  it('la pagina viaja en base 1, que es la que se ve en pantalla', async () => {
    const { fixture, router } = montar();
    fixture.detectChanges();

    fixture.componentInstance.pagina.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toContain('pagina=3');
  });

  it('la primera pagina no aparece en la URL', async () => {
    const { fixture, router } = montar();
    fixture.componentInstance.pagina.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.pagina.set(0);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).not.toContain('pagina=');
  });
});
