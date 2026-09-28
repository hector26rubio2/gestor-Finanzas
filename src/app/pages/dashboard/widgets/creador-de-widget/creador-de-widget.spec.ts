import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RUNTIME_CONFIG } from '@core/session';
import type { ChartOption } from '@ui/chart';
import { CreadorDeWidgetComponent } from './creador-de-widget';

function crear(opcion: ChartOption, hayDatos = true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } }],
  });
  const fixture = TestBed.createComponent(CreadorDeWidgetComponent);
  fixture.componentRef.setInput('opcionDe', () => opcion);
  fixture.componentRef.setInput('hayDatos', hayDatos);
  return fixture.componentInstance;
}

describe('vista previa del creador de widgets', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin movimientos en el periodo avisa en vez de dejar la caja en blanco', () => {
    expect(crear({ series: [{ type: 'bar', data: [1] }] }, false).previaVacia()).toBe(true);
  });

  it('con series vacías también avisa', () => {
    expect(crear({ series: [] }).previaVacia()).toBe(true);
    expect(crear({ series: [{ type: 'bar', data: [] }] }).previaVacia()).toBe(true);
  });

  it('con datos muestra la gráfica', () => {
    expect(crear({ series: [{ type: 'bar', data: [120] }] }).previaVacia()).toBe(false);
    expect(
      crear({ series: [{ type: 'sankey', data: [], links: [{ source: 'a', target: 'b', value: 1 }] }] }).previaVacia(),
    ).toBe(false);
  });
});
