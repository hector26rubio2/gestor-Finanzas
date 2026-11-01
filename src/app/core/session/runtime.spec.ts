import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRuntimeConfig } from './runtime';

describe('readRuntimeConfig', () => {
  it('reads the configured API URL', () => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
    expect(readRuntimeConfig()).toEqual({ apiBaseUrl: 'http://api.test' });
  });

  it('normalizes an explicitly configured API URL', () => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test/' };
    expect(readRuntimeConfig()).toEqual({ apiBaseUrl: 'https://api.example.test' });
  });

  it('fails closed when there is no endpoint', () => {
    window.__FINANZAS_CONFIG__ = {};
    expect(() => readRuntimeConfig()).toThrow(/apiBaseUrl/);
  });

  it('does not silently start with fictitious data when config.js is missing', () => {
    delete window.__FINANZAS_CONFIG__;
    expect(() => readRuntimeConfig()).toThrow(/Falta config.js/);
  });

  it('sin config.js y sin red arranca el shell con una URL vacía para mostrar el error de datos', () => {
    delete window.__FINANZAS_CONFIG__;
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    expect(readRuntimeConfig()).toEqual({ apiBaseUrl: '' });
  });

  afterEach(() => vi.restoreAllMocks());
});
