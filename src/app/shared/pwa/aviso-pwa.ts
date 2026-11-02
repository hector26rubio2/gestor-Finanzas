import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { ActualizacionPwa } from '@core/pwa/actualizacion.service';
import { Conexion } from '@core/pwa/conexion.service';
import { HlmButton } from '@spartan-ng/helm/button';

@Component({
  selector: 'fin-aviso-pwa',
  imports: [HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed inset-x-0 bottom-0 z-[300] grid justify-items-center gap-2 p-3 pwa-safe-bottom',
  },
  template: `
    @if (!conexion.enLinea()) {
      <div
        role="status"
        data-testid="aviso-sin-conexion"
        class="pointer-events-auto max-w-[min(32rem,100%)] rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-lg"
      >
        {{ i18n.t('pwa.offline') }}
      </div>
    }
    @if (actualizacion.versionNueva()) {
      <div
        role="status"
        data-testid="aviso-version-nueva"
        class="pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-lg"
      >
        <span>{{ i18n.t('pwa.updateAvailable') }}</span>
        <button hlmBtn size="sm" type="button" (click)="actualizacion.actualizar()">{{ i18n.t('pwa.update') }}</button>
      </div>
    }
    @if (actualizacion.falloDeInstalacion()) {
      <div
        role="alert"
        data-testid="aviso-fallo-version"
        class="pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-lg"
      >
        <span>{{ i18n.t('pwa.updateFailed') }}</span>
        <button hlmBtn size="sm" variant="ghost" type="button" (click)="actualizacion.descartarFallo()">
          {{ i18n.t('pwa.dismiss') }}
        </button>
      </div>
    }
  `,
})
export class AvisoPwaComponent {
  readonly i18n = inject(I18nService);
  readonly conexion = inject(Conexion);
  readonly actualizacion = inject(ActualizacionPwa);
}
