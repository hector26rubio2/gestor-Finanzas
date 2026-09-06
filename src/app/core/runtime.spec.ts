import { describe, expect, it } from 'vitest';
import { readRuntimeConfig } from './runtime';

describe('readRuntimeConfig', () => {
  it('uses demo only when the deployment config explicitly selects it', () => {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    expect(readRuntimeConfig()).toEqual({ mode: 'demo' });
  });

  it('normalizes an explicitly configured API URL', () => {
    window.__FINANZAS_CONFIG__ = { mode: 'api', apiBaseUrl: 'https://api.example.test/' };
    expect(readRuntimeConfig()).toEqual({ mode: 'api', apiBaseUrl: 'https://api.example.test' });
  });

  it('fails closed when API mode has no endpoint', () => {
    window.__FINANZAS_CONFIG__ = { mode: 'api' };
    expect(() => readRuntimeConfig()).toThrow(/apiBaseUrl/);
  });

  it('does not silently start with fictitious data when config.js is missing', () => {
    delete window.__FINANZAS_CONFIG__;
    expect(() => readRuntimeConfig()).toThrow(/Falta config.js/);
  });
});
