import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Lo que se enseña cuando alguien puede entrar a una pantalla pero no recibir sus datos.
 *
 * `ver` abre la vista y `listar` entrega el contenido: son permisos distintos a
 * proposito. Pero con el primero y sin el segundo, la pantalla se pintaba entera y vacia
 * —titulo, filtros, «limpiar filtros»— sin una sola cifra y sin decir por que. Una
 * pantalla vacia sin explicacion se lee como averiada, y quien la ve reporta un fallo
 * que no existe en vez de pedir el permiso que le falta.
 */
@Component({
  selector: 'demo-sin-acceso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="sin-acceso" role="status">
    <h2>Tu acceso no incluye el contenido de esta pantalla</h2>
    <p>
      Puedes entrar, pero no recibir sus datos. Si necesitas verlos, pídele a quien administra tu espacio el permiso
      <code>{{ permiso() }}</code
      >.
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
      code {
        background: var(--accent-soft);
        border-radius: 5px;
        padding: 1px 6px;
      }
    `,
  ],
})
export class SinAccesoComponent {
  /** El permiso que hace falta, dicho tal cual para poder pedirlo por su nombre. */
  readonly permiso = input.required<string>();
}
