import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type TamanoDePantalla = 'compacto' | 'medio' | 'amplio' | 'expandido';

export const CORTES_DE_PANTALLA = { medio: 600, amplio: 1024, expandido: 1280 } as const;

export function esTableta(tamano: TamanoDePantalla): boolean {
  return tamano === 'medio' || tamano === 'amplio';
}

@Injectable({ providedIn: 'root' })
export class Pantalla {
  private readonly _tamano = signal<TamanoDePantalla>('expandido');
  readonly tamano = this._tamano.asReadonly();

  constructor() {
    const vista = inject(DOCUMENT).defaultView;
    if (typeof vista?.matchMedia !== 'function') return;
    const consultas = [CORTES_DE_PANTALLA.medio, CORTES_DE_PANTALLA.amplio, CORTES_DE_PANTALLA.expandido].map((corte) =>
      vista.matchMedia(`(min-width: ${corte}px)`),
    );
    const [medio, amplio, expandido] = consultas;
    const actualizar = () =>
      this._tamano.set(
        expandido.matches ? 'expandido' : amplio.matches ? 'amplio' : medio.matches ? 'medio' : 'compacto',
      );
    actualizar();
    consultas.forEach((consulta) => consulta.addEventListener('change', actualizar));
    inject(DestroyRef).onDestroy(() =>
      consultas.forEach((consulta) => consulta.removeEventListener('change', actualizar)),
    );
  }
}
