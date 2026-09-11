import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RemoteBootstrap } from '../core/remote-bootstrap';

/**
 * Lo que se enseña cuando la sesión no tiene ninguna sección abierta.
 *
 * Es el fondo de saco del guard: si ni una entrada del menú pasa el permiso y su bandera,
 * no hay adónde mandar a nadie. Antes el guard devolvía `/dashboard` en ese caso y el
 * dashboard volvía a rebotar por la misma razón, así que el navegador se quedaba girando
 * en un bucle de redirecciones y la pestaña dejaba de responder: ni la pantalla de acceso
 * ni un aviso, solo una aplicación colgada.
 */
@Component({
  selector: 'demo-sin-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="sin-seccion" role="status">
    <h1>Tu acceso no abre ninguna sección</h1>
    <p>
      La sesión se inició bien, pero ninguna de las pantallas está habilitada para ti: o no tienes su permiso, o la
      funcionalidad está apagada en este espacio. Pídele a quien administra el espacio lo que necesites.
    </p>
    <button type="button" (click)="reintentar()">Volver a comprobar mi acceso</button>
  </section>`,
  styles: [
    `
      .sin-seccion {
        margin: 48px auto;
        max-width: 60ch;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        padding: 32px;
        display: grid;
        gap: 12px;
        justify-items: start;
        color: var(--text);
      }
      h1 {
        margin: 0;
        font-size: 1.2rem;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      button {
        margin-top: 6px;
      }
    `,
  ],
})
export class SinSeccionComponent {
  private readonly arranque = inject(RemoteBootstrap);

  /** Quien administra puede conceder el acceso mientras esta pantalla está abierta. */
  reintentar(): void {
    void this.arranque.initialize();
  }
}
