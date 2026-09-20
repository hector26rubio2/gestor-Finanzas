import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi } from '../api/administration.api';
import { AppStore } from '../state/store';
import { patchConsole } from '../utils/console-buffer';
import { fingerprintOf, isIgnoredMessage } from './error-report';
import { ErrorReporter } from './error-reporter';

describe('fingerprintOf', () => {
  it('agrupa el mismo error aunque cambien números e identificadores', () => {
    const a = fingerprintOf('console', 'No se pudo cargar la cuenta 123 de 3f2b8c1e-1111-4222-8333-444455556666');
    const b = fingerprintOf('console', 'No se pudo cargar la cuenta 987 de aaaaaaaa-1111-4222-8333-444455556666');
    expect(a).toBe(b);
  });

  it('separa errores distintos y orígenes distintos', () => {
    expect(fingerprintOf('console', 'uno')).not.toBe(fingerprintOf('console', 'dos'));
    expect(fingerprintOf('console', 'uno')).not.toBe(fingerprintOf('window', 'uno'));
  });

  it('cabe en el límite del servidor', () => {
    expect(fingerprintOf('promise', 'x'.repeat(5000)).length).toBeLessThanOrEqual(128);
  });
});

describe('isIgnoredMessage', () => {
  it('descarta el ruido conocido del navegador', () => {
    expect(isIgnoredMessage('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isIgnoredMessage('Script error.')).toBe(true);
    expect(isIgnoredMessage('Falló algo real')).toBe(false);
  });
});

describe('ErrorReporter', () => {
  const reportClientError = vi.fn((payload: { source: string; message: string; contextJson: string }) => {
    void payload;
    return of({});
  });
  const user = signal<{ id: string; name: string; email: string } | null>({
    id: 'u1',
    name: 'Ana Pérez',
    email: 'ana@finanzas.test',
  });
  let reporter: ErrorReporter;

  beforeEach(() => {
    patchConsole();
    reportClientError.mockClear();
    user.set({ id: 'u1', name: 'Ana Pérez', email: 'ana@finanzas.test' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AdministrationApi, useValue: { reportClientError } },
        {
          provide: AppStore,
          useValue: {
            runtime: { mode: 'api' },
            user,
            organization: signal({ id: 'o1', name: 'Organización general' }),
          },
        },
      ],
    });
    reporter = TestBed.inject(ErrorReporter);
    reporter.start();
  });

  afterEach(() => reporter.stop());

  it('reporta un console.error con la organización y la persona', () => {
    console.error('Fallo al guardar', new Error('boom'));

    expect(reportClientError).toHaveBeenCalledTimes(1);
    const payload = reportClientError.mock.calls[0][0];
    const context = JSON.parse(payload.contextJson);
    expect(payload.source).toBe('web');
    expect(payload.message).toContain('Fallo al guardar');
    expect(context.organization).toEqual({ id: 'o1', name: 'Organización general' });
    expect(context.user).toEqual({ id: 'u1', name: 'Ana Pérez', email: 'ana@finanzas.test' });
    expect(context.stack).toContain('boom');
    expect(context.origin).toBe('console');
  });

  it('no repite el mismo error', () => {
    console.error('Cuenta 1 no existe');
    console.error('Cuenta 2 no existe');

    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it('ignora console.log y console.warn', () => {
    console.log('hola');
    console.warn('ojo');

    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('no reporta sin sesión', () => {
    user.set(null);

    console.error('Fallo sin sesión');

    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('reporta los errores no capturados de la ventana', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught TypeError: x', error: new TypeError('x') }));

    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it('limita cuántos errores distintos salen por minuto', () => {
    for (let i = 0; i < 30; i++) console.error(`Error distinto ${'x'.repeat(i)}`);

    expect(reportClientError).toHaveBeenCalledTimes(10);
  });
});
