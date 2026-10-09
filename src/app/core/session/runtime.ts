import { InjectionToken } from '@angular/core';

export interface FinanzasRuntimeConfig {
  apiBaseUrl: string;
  commit?: string;
}

declare global {
  interface Window {
    __FINANZAS_CONFIG__?: Partial<FinanzasRuntimeConfig>;
  }
}

export function readRuntimeConfig(): FinanzasRuntimeConfig {
  const configured = window.__FINANZAS_CONFIG__;
  if (!configured?.apiBaseUrl) throw new Error('Falta config.js: configure apiBaseUrl con el endpoint de la API.');
  return { apiBaseUrl: configured.apiBaseUrl.replace(/\/$/, ''), commit: configured.commit };
}

export const RUNTIME_CONFIG = new InjectionToken<FinanzasRuntimeConfig>('RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: readRuntimeConfig,
});
