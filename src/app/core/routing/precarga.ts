import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';

export const CLAVE_DE_PRECARGA = 'precarga';

@Injectable({ providedIn: 'root' })
export class PrecargaBajoDemanda implements PreloadingStrategy {
  private readonly pendientes = new Map<string, (() => Observable<unknown>)[]>();

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const clave = (route.data?.[CLAVE_DE_PRECARGA] as string | undefined) ?? route.path;
    if (clave) this.pendientes.set(clave, [...(this.pendientes.get(clave) ?? []), load]);
    return EMPTY;
  }

  precargar(ruta: string): void {
    const cargas = this.pendientes.get(ruta);
    if (!cargas) return;
    this.pendientes.delete(ruta);
    for (const cargar of cargas) cargar().subscribe({ error: () => undefined });
  }
}
