import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { RUNTIME_CONFIG } from '@core/session/runtime';

const MAX_PETICIONES = 40;
const CABECERA_ACCION = 'X-Finanzas-Accion';
export const CODIGO_CANCELADA = 'cancelada';

export interface PeticionRegistrada {
  readonly at: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly ms: number;
  readonly action: string;
  readonly code: string;
}

@Injectable({ providedIn: 'root' })
export class RegistroDePeticiones {
  private readonly entradas: PeticionRegistrada[] = [];

  agregar(entrada: PeticionRegistrada): void {
    this.entradas.push(entrada);
    if (this.entradas.length > MAX_PETICIONES) this.entradas.shift();
  }

  ultimas(): readonly PeticionRegistrada[] {
    return [...this.entradas];
  }
}

export function rutaSinValores(url: string, base: string): string {
  const relativa = new URL(url.slice(base.length) || '/', 'http://local');
  const claves = [...new Set(relativa.searchParams.keys())];
  return claves.length ? `${relativa.pathname}?${claves.join('&')}` : relativa.pathname;
}

function codigoDelProblema(cuerpo: unknown): string {
  return cuerpo && typeof cuerpo === 'object' && 'code' in cuerpo && typeof cuerpo.code === 'string' ? cuerpo.code : '';
}

function horaActual(): string {
  return new Date().toISOString().slice(11, 19);
}

export const registroDePeticionesInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(RUNTIME_CONFIG);
  if (!config.apiBaseUrl || !req.url.startsWith(config.apiBaseUrl)) return next(req);
  const registro = inject(RegistroDePeticiones);
  const inicio = performance.now();
  const at = horaActual();
  let terminada = false;
  const anotar = (status: number, code: string) => {
    terminada = true;
    registro.agregar({
      at,
      method: req.method,
      path: rutaSinValores(req.urlWithParams, config.apiBaseUrl),
      status,
      ms: Math.round(performance.now() - inicio),
      action: req.headers.get(CABECERA_ACCION) ?? '',
      code,
    });
  };
  return next(req).pipe(
    tap({
      next: (evento) => {
        if (evento instanceof HttpResponse) anotar(evento.status, '');
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) anotar(error.status, codigoDelProblema(error.error));
      },
    }),
    finalize(() => {
      if (!terminada) anotar(0, CODIGO_CANCELADA);
    }),
  );
};
