import { Injectable } from '@angular/core';

export interface ConsoleEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  at: string;
}

const MAX_ENTRIES = 200;
const buffer: ConsoleEntry[] = [];
let patched = false;

/** Convierte argumentos de consola en texto legible, sin reventar con referencias circulares. */
function toMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

/**
 * Parchea `console.*` para guardar un buffer circular de las últimas entradas. Se llama
 * una sola vez, antes de `bootstrapApplication`, para no perderse los logs de arranque.
 */
export function patchConsole(): void {
  if (patched || typeof console === 'undefined') return;
  patched = true;
  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      buffer.push({ level, message: toMessage(args).slice(0, 500), at: new Date().toISOString() });
      if (buffer.length > MAX_ENTRIES) buffer.shift();
      original(...args);
    };
  });
}

@Injectable({ providedIn: 'root' })
export class ConsoleBufferService {
  snapshot(): readonly ConsoleEntry[] {
    return [...buffer];
  }
}
