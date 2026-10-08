import { Component, computed, inject } from '@angular/core';
import { IconComponent } from '@ui/icon';
import { HlmButton } from '@spartan-ng/helm/button';
import { RouterLink } from '@angular/router';
import { RemoteBootstrap } from '@core/session';
import { AppStore } from '@core/state';
import { I18nService } from '@core/i18n';

@Component({
  selector: 'fin-sin-seccion',
  imports: [IconComponent, HlmButton, RouterLink],
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

  readonly haySesion = computed(() => !!this.store.user());

  reintentar(): void {
    void this.arranque.initialize();
  }
}
