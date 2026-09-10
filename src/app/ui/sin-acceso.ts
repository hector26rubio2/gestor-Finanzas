import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Lo que se enseña cuando se puede entrar a una pantalla y no se ha concedido ni uno de
 * sus bloques.
 *
 * Reportes y Planificación no tienen un listado propio: son un conjunto de bloques, cada
 * uno con su permiso. Sin ninguno la pantalla se pintaba entera y vacía —título, cabecera
 * y nada más—, y una pantalla vacía sin explicación se lee como averiada: quien la ve
 * reporta un fallo que no existe en vez de pedir lo que le falta.
 */
@Component({
  selector: 'demo-sin-acceso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="sin-acceso" role="status">
    <h2>Tu acceso a esta pantalla no incluye ninguno de sus bloques</h2>
    <p>
      Puedes entrar, pero no se te ha concedido ninguna de las piezas que la componen. Pídele a quien administra tu
      espacio las que necesites.
    </p>
  </section>`,
  styles: [
    `
      .sin-acceso {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        padding: 28px;
        display: grid;
        gap: 8px;
        justify-items: start;
      }
      h2 {
        margin: 0;
        font-size: 1.05rem;
      }
      p {
        margin: 0;
        color: var(--muted);
        max-width: 60ch;
      }
    `,
  ],
})
export class SinAccesoComponent {}
