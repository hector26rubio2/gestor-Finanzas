import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { RouterLink } from '@angular/router';
import { RemoteBootstrap } from '../../core/session/remote-bootstrap';
import { AppStore } from '../../core/state/store';
import { I18nService } from '../../core/i18n';

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
  selector: 'fin-sin-seccion',
  imports: [HlmButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sin-seccion.html',
  host: {
    class:
      'mx-auto my-12 grid max-w-[60ch] justify-items-start gap-3 rounded-lg border border-border bg-card p-8 text-foreground',
  },
})
export class SinSeccionComponent {
  readonly i18n = inject(I18nService);
  private readonly arranque = inject(RemoteBootstrap);
  private readonly store = inject(AppStore);

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
