import { InjectionToken } from '@angular/core';

export interface FinanzasRuntimeConfig {
  mode: 'demo' | 'api';
  apiBaseUrl?: string;
}

declare global {
  interface Window {
    __FINANZAS_CONFIG__?: Partial<FinanzasRuntimeConfig>;
  }
}

export function readRuntimeConfig(): FinanzasRuntimeConfig {
  const configured = window.__FINANZAS_CONFIG__;
  if (!configured?.mode) throw new Error('Falta config.js: seleccione explícitamente mode demo o api.');
  if (configured?.mode === 'api') {
    if (!configured.apiBaseUrl) throw new Error('apiBaseUrl es obligatorio cuando mode es api.');
    return { mode: 'api', apiBaseUrl: configured.apiBaseUrl.replace(/\/$/, '') };
  }
  if (configured.mode === 'demo') return { mode: 'demo' };
  throw new Error('El modo de ejecución configurado no es válido.');
}

export const RUNTIME_CONFIG = new InjectionToken<FinanzasRuntimeConfig>('RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: readRuntimeConfig,
});
