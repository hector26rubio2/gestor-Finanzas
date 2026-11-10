import { Component, computed, inject, input, signal } from '@angular/core';
import { Pantalla, TamanoDePantalla } from '@ui/pantalla';

export type ContenedorDeDetalle = 'acoplado' | 'superpuesto';

export function contenedorDeDetalle(tamano: TamanoDePantalla, habilitado: boolean): ContenedorDeDetalle {
  return habilitado && tamano === 'amplio' ? 'acoplado' : 'superpuesto';
}

@Component({
  selector: 'fin-lista-y-detalle',
  template: '<ng-content />',
  host: {
    '[class]': 'acoplado() ? "flex min-h-0 flex-1 [&>*]:min-w-0" : "contents"',
  },
})
export class ListaYDetalleComponent {
  private readonly pantalla = inject(Pantalla);
  readonly habilitado = input(true);
  readonly contenedor = computed(() => contenedorDeDetalle(this.pantalla.tamano(), this.habilitado()));
  readonly acoplado = computed(() => this.contenedor() === 'acoplado');
  readonly detalleAcoplado = signal(false);
}
