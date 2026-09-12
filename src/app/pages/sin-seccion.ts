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
  templateUrl: './sin-seccion.html',
  styleUrl: './sin-seccion.css',
})
export class SinSeccionComponent {
  private readonly arranque = inject(RemoteBootstrap);

  /** Quien administra puede conceder el acceso mientras esta pantalla está abierta. */
  reintentar(): void {
    void this.arranque.initialize();
  }
}
