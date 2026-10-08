import { Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { EmptyStateComponent } from '@ui/empty-state/empty-state';

@Component({
  selector: 'fin-sin-acceso',
  imports: [EmptyStateComponent],
  host: { class: 'block rounded-lg border border-border bg-card', role: 'status' },
  template: `<fin-empty icon="shield" [title]="i18n.t('sinAcceso.title')" [detail]="i18n.t('sinAcceso.detail')" />`,
})
export class SinAccesoComponent {
  readonly i18n = inject(I18nService);
}
