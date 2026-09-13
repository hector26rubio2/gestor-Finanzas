import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RemoteBootstrap } from '../core/remote-bootstrap';
import { DemoStore } from '../core/store';
import { I18nService } from '../core/i18n';

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
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sin-seccion.html',
  styleUrl: './sin-seccion.css',
})
export class SinSeccionComponent {
  readonly i18n = inject(I18nService);
  private readonly arranque = inject(RemoteBootstrap);
  private readonly store = inject(DemoStore);

  /**
   * A esta ruta se llega tecleandola, y sin sesion el texto daba por hecho lo contrario:
   * hablaba de permisos y de banderas a quien todavia no habia entrado.
   */
  readonly haySesion = computed(() => !!this.store.user());

  /** Quien administra puede conceder el acceso mientras esta pantalla está abierta. */
  reintentar(): void {
    void this.arranque.initialize();
  }
}
