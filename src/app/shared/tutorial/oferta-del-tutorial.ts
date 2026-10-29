import { Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { HlmButton } from '@spartan-ng/helm/button';
import { OverlayComponent } from '@ui/overlay';
import { SelectorDeIdiomaComponent } from './selector-de-idioma';
import { TutorialService } from './tutorial.service';

@Component({
  selector: 'fin-oferta-del-tutorial',
  imports: [HlmButton, OverlayComponent, SelectorDeIdiomaComponent],
  template: `
    <fin-overlay [title]="i18n.t('tutorial.offer.title')" mode="modal" (closed)="descartar()">
      <div class="grid gap-5" data-testid="oferta-del-tutorial">
        <section class="grid gap-2" [attr.aria-label]="i18n.t('tutorial.offer.language')">
          <h3 class="text-sm font-semibold">{{ i18n.t('tutorial.offer.language') }}</h3>
          <fin-selector-de-idioma />
        </section>
        <p class="text-sm text-muted-foreground">{{ i18n.t('tutorial.offer.text') }}</p>
        <footer class="flex justify-end gap-2.5">
          <button hlmBtn variant="outline" type="button" data-testid="oferta-ahora-no" (click)="descartar()">
            {{ i18n.t('tutorial.offer.no') }}
          </button>
          <button hlmBtn type="button" data-testid="oferta-aceptar" (click)="aceptar()">
            {{ i18n.t('tutorial.offer.yes') }}
          </button>
        </footer>
      </div>
    </fin-overlay>
  `,
})
export class OfertaDelTutorialComponent {
  readonly i18n = inject(I18nService);
  readonly tutorial = inject(TutorialService);

  aceptar(): void {
    this.tutorial.marcarVisto();
    setTimeout(() => void this.tutorial.iniciarGuia('primeros-pasos'));
  }

  descartar(): void {
    this.tutorial.marcarVisto();
  }
}
