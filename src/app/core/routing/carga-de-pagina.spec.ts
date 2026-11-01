import { TestBed } from '@angular/core/testing';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Route,
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  Router,
  RouterEvent,
} from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CargaDePagina, RETARDO_DE_BARRA_MS, UMBRAL_DE_LENTITUD_MS } from './carga-de-pagina';

describe('CargaDePagina', () => {
  let eventos: Subject<RouterEvent | RouteConfigLoadStart | RouteConfigLoadEnd>;
  let carga: CargaDePagina;
  const ruta: Route = {};

  beforeEach(() => {
    vi.useFakeTimers();
    eventos = new Subject();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events: eventos } }] });
    carga = TestBed.inject(CargaDePagina);
  });

  afterEach(() => vi.useRealTimers());

  const inicio = () => eventos.next(new NavigationStart(1, '/movements'));
  const fin = () => eventos.next(new NavigationEnd(1, '/movements', '/movements'));

  it('arranca sin navegar ni lentitud', () => {
    expect(carga.navegando()).toBe(false);
    expect(carga.lenta()).toBe(false);
  });

  it('una navegación más corta que el retardo nunca muestra la barra', () => {
    inicio();
    vi.advanceTimersByTime(RETARDO_DE_BARRA_MS - 1);
    expect(carga.navegando()).toBe(false);
    fin();
    vi.advanceTimersByTime(1000);
    expect(carga.navegando()).toBe(false);
    expect(carga.lenta()).toBe(false);
  });

  it('muestra la barra pasado el retardo y la quita al terminar', () => {
    inicio();
    vi.advanceTimersByTime(RETARDO_DE_BARRA_MS);
    expect(carga.navegando()).toBe(true);
    expect(carga.lenta()).toBe(false);
    fin();
    expect(carga.navegando()).toBe(false);
  });

  it('marca la carga como lenta pasado el umbral y la limpia al terminar', () => {
    inicio();
    vi.advanceTimersByTime(UMBRAL_DE_LENTITUD_MS);
    expect(carga.navegando()).toBe(true);
    expect(carga.lenta()).toBe(true);
    fin();
    expect(carga.navegando()).toBe(false);
    expect(carga.lenta()).toBe(false);
  });

  it('la descarga de configuración de ruta también cuenta como carga', () => {
    eventos.next(new RouteConfigLoadStart(ruta));
    vi.advanceTimersByTime(RETARDO_DE_BARRA_MS);
    expect(carga.navegando()).toBe(true);
    eventos.next(new RouteConfigLoadEnd(ruta));
    expect(carga.navegando()).toBe(true);
    fin();
    expect(carga.navegando()).toBe(false);
  });

  it('una cancelación termina la carga', () => {
    inicio();
    vi.advanceTimersByTime(RETARDO_DE_BARRA_MS);
    eventos.next(new NavigationCancel(1, '/movements', 'x', NavigationCancellationCode.Redirect));
    expect(carga.navegando()).toBe(false);
  });

  it('un error de navegación termina la carga', () => {
    inicio();
    vi.advanceTimersByTime(UMBRAL_DE_LENTITUD_MS);
    eventos.next(new NavigationError(1, '/movements', new Error('fallo')));
    expect(carga.navegando()).toBe(false);
    expect(carga.lenta()).toBe(false);
  });

  it('una redirección que reinicia la navegación no reinicia los umbrales', () => {
    inicio();
    vi.advanceTimersByTime(RETARDO_DE_BARRA_MS);
    inicio();
    expect(carga.navegando()).toBe(true);
    vi.advanceTimersByTime(UMBRAL_DE_LENTITUD_MS - RETARDO_DE_BARRA_MS);
    expect(carga.lenta()).toBe(true);
  });

  it('tras terminar, una navegación nueva vuelve a esperar el retardo', () => {
    inicio();
    vi.advanceTimersByTime(UMBRAL_DE_LENTITUD_MS);
    fin();
    inicio();
    expect(carga.navegando()).toBe(false);
    vi.advanceTimersByTime(RETARDO_DE_BARRA_MS);
    expect(carga.navegando()).toBe(true);
    expect(carga.lenta()).toBe(false);
  });
});
