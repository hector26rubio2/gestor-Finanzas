import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from '../../core/api/api-client';
import { RUNTIME_CONFIG } from '../../core/session/runtime';
import { BugReportButtonComponent } from './bug-report';

describe('botón flotante de reportes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
        { provide: FinanceApiClient, useValue: { session: vi.fn(() => of(null)) } },
      ],
    });
  });

  function montar() {
    const fixture = TestBed.createComponent(BugReportButtonComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  const puntero = (x: number, y: number) =>
    ({ clientX: x, clientY: y, currentTarget: document.createElement('div') }) as unknown as PointerEvent;

  it('arranca en la esquina inferior derecha', () => {
    expect(montar().component.fab()).toEqual({ right: 24, bottom: 24 });
  });

  it('arrastrarlo cambia la posición, la guarda y no abre el formulario', () => {
    const { component } = montar();
    component.startFabDrag(puntero(500, 500));
    component.moveFab(puntero(400, 450));
    component.endFabDrag();

    expect(component.fab()).toEqual({ right: 124, bottom: 74 });
    component.press();
    expect(component.open()).toBe(false);
    expect(JSON.parse(localStorage.getItem('finanzas.bug-report.fab.v1') ?? 'null')).toEqual(component.fab());
    component.press();
    expect(component.open()).toBe(true);
  });

  it('un toque sin arrastre abre el formulario', () => {
    const { component } = montar();
    component.startFabDrag(puntero(10, 10));
    component.moveFab(puntero(11, 11));
    component.endFabDrag();
    component.press();
    expect(component.open()).toBe(true);
  });

  it('con teclado se mueve con Alt y flechas y Alt+Inicio lo restablece', () => {
    const { component } = montar();
    component.moveFabByKey(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));
    expect(component.fab().right).toBe(40);
    component.moveFabByKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.fab().right).toBe(40);
    component.moveFabByKey(new KeyboardEvent('keydown', { key: 'Home', altKey: true }));
    expect(component.fab()).toEqual({ right: 24, bottom: 24 });
    expect(localStorage.getItem('finanzas.bug-report.fab.v1')).toBeNull();
  });

  it('una posición guardada fuera de la ventana se acota al cargar', () => {
    localStorage.setItem('finanzas.bug-report.fab.v1', JSON.stringify({ right: 99999, bottom: -50 }));
    const { component } = montar();
    expect(component.fab().bottom).toBe(8);
    expect(component.fab().right).toBeLessThan(window.innerWidth);
  });
});
