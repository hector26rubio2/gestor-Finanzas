import { Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { TutorialService } from './tutorial.service';

@Component({
  selector: 'fin-oferta-del-tutorial',
  imports: [ConfirmDialogComponent],
  template: `
    <fin-confirm-dialog
      [open]="true"
      [title]="i18n.t('tutorial.offer.title')"
      [description]="i18n.t('tutorial.offer.text')"
      [confirmLabel]="i18n.t('tutorial.offer.yes')"
      [cancelLabel]="i18n.t('tutorial.offer.no')"
      (confirmed)="aceptar()"
      (dismissed)="tutorial.marcarVisto()"
    />
  `,
})
export class OfertaDelTutorialComponent {
  readonly i18n = inject(I18nService);
  readonly tutorial = inject(TutorialService);

  aceptar(): void {
    this.tutorial.marcarVisto();
    setTimeout(() => void this.tutorial.iniciar());
  }
}
