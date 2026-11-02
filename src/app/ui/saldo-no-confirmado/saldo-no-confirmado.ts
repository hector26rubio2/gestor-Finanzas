import { Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state';
import { IconComponent } from '@ui/icon';

@Component({
  selector: 'fin-saldo-no-confirmado',
  imports: [IconComponent],
  host: { class: 'contents' },
  template: `
    @if (!store.saldos().confirmado) {
      <p
        role="status"
        data-slot="saldo-no-confirmado"
        class="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground"
        [title]="i18n.t('balances.unconfirmed.hint')"
      >
        <fin-icon name="warning" class="[--icon-size:14px]" />
        {{ i18n.t('balances.unconfirmed.label') }}
      </p>
    }
  `,
})
export class SaldoNoConfirmadoComponent {
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
}
