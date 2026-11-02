import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_DE_ARRANQUE, guardarPreferenciaDeArranque, retirarPantallaDeArranque } from './pantalla-de-arranque';

describe('preferencias de arranque', () => {
  beforeEach(() => localStorage.removeItem(CLAVE_DE_ARRANQUE));
  afterEach(() => localStorage.removeItem(CLAVE_DE_ARRANQUE));

  it('guarda el tema y el idioma por separado sin pisar el otro', () => {
    guardarPreferenciaDeArranque({ theme: 'dark' });
    guardarPreferenciaDeArranque({ locale: 'fr' });
    expect(JSON.parse(localStorage.getItem(CLAVE_DE_ARRANQUE) ?? '{}')).toEqual({ theme: 'dark', locale: 'fr' });
  });

  it('no falla si el almacenamiento no está disponible', () => {
    const espia = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => guardarPreferenciaDeArranque({ theme: 'light' })).not.toThrow();
    espia.mockRestore();
  });
});

describe('retirar la pantalla de arranque', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="arranque"></div><app-root></app-root>';
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('la marca como saliendo y la quita del documento tras la transición', () => {
    vi.useFakeTimers();
    retirarPantallaDeArranque();
    const pantalla = document.getElementById('arranque');
    expect(pantalla?.dataset['saliendo']).toBe('true');
    expect(pantalla?.getAttribute('aria-hidden')).toBe('true');
    vi.advanceTimersByTime(400);
    expect(document.getElementById('arranque')).toBeNull();
  });

  it('puede llamarse sin pantalla de arranque', () => {
    document.body.innerHTML = '';
    expect(() => retirarPantallaDeArranque()).not.toThrow();
  });

  it('puede llamarse dos veces', () => {
    vi.useFakeTimers();
    retirarPantallaDeArranque();
    retirarPantallaDeArranque();
    vi.advanceTimersByTime(400);
    expect(document.getElementById('arranque')).toBeNull();
  });
});
