import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RUNTIME_CONFIG } from '@core/session/runtime';

const CABECERA_ACCION = 'X-Finanzas-Accion';

const nuevaAccion = () => crypto.randomUUID();

@Injectable({ providedIn: 'root' })
export class AccionDeUsuario {
  private actual = nuevaAccion();
  private conActividad: string | null = null;

  constructor() {
    if (typeof document === 'undefined') return;
    const iniciar = () => (this.actual = nuevaAccion());
    document.addEventListener('pointerdown', iniciar, true);
    document.addEventListener('submit', iniciar, true);
    document.addEventListener(
      'keydown',
      (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') iniciar();
      },
      true,
    );
  }

  id(): string {
    return this.actual;
  }

  usar(): string {
    this.conActividad = this.actual;
    return this.actual;
  }

  ultimaConActividad(): string | null {
    return this.conActividad;
  }
}

export const accionInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(RUNTIME_CONFIG);
  if (!config.apiBaseUrl || !req.url.startsWith(config.apiBaseUrl)) return next(req);
  return next(req.clone({ setHeaders: { [CABECERA_ACCION]: inject(AccionDeUsuario).usar() } }));
};
