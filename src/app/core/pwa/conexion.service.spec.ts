import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Conexion } from './conexion.service';

describe('conexión', () => {
  it('sigue los eventos online y offline', () => {
    const conexion = TestBed.inject(Conexion);
    conexion.iniciar();
    window.dispatchEvent(new Event('offline'));
    expect(conexion.enLinea()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(conexion.enLinea()).toBe(true);
  });
});
