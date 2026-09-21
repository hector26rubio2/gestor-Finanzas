import { Injectable, signal } from '@angular/core';
import { notifier } from '../notifications/notifier';

export interface AsyncActionMessages<T> {
  loading: string;
  success: string | ((value: T) => string);
  error: string | ((error: unknown) => string);
}

/**
 * Ejecuta escrituras remotas con una sola operación en vuelo por clave.
 *
 * El mismo `Promise` se reutiliza si el usuario vuelve a enviar el formulario antes
 * de que termine. Además de evitar dobles escrituras, el toast conserva su sitio y
 * cambia de cargando a éxito o error cuando se resuelve la petición.
 */
@Injectable({ providedIn: 'root' })
export class AsyncActionService {
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly runningKeys = signal<ReadonlySet<string>>(new Set());

  isRunning(key: string): boolean {
    return this.runningKeys().has(key);
  }

  run<T>(key: string, factory: () => Promise<T>, messages: AsyncActionMessages<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    this.runningKeys.update((keys) => new Set(keys).add(key));
    const operation = Promise.resolve()
      .then(factory)
      .finally(() => {
        this.pending.delete(key);
        this.runningKeys.update((keys) => {
          const next = new Set(keys);
          next.delete(key);
          return next;
        });
      });

    this.pending.set(key, operation);
    void notifier().then((toast) => toast.promise(operation, messages));
    return operation;
  }
}
