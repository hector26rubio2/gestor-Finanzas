import { Component, computed, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state/store';
import { SegmentedComponent, type SegmentedOption } from '@ui/segmented';
import { TutorialService } from './tutorial.service';

export const IDIOMAS_DEL_TUTORIAL: readonly SegmentedOption[] = [
  { value: 'es-CO', label: 'Español' },
  { value: 'en-US', label: 'English' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'pt-BR', label: 'Português' },
];

@Component({
  selector: 'fin-selector-de-idioma',
  imports: [SegmentedComponent],
  template: `
    <fin-segmented
      data-tour="tutorial-idioma"
      [value]="actual()"
      [options]="opciones"
      [ariaLabel]="i18n.t('tutorial.center.language')"
      (valueChange)="elegir($event)"
    />
  `,
})
export class SelectorDeIdiomaComponent {
  readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);
  private readonly tutorial = inject(TutorialService);
  readonly opciones = IDIOMAS_DEL_TUTORIAL;
  readonly actual = computed(() => {
    const idioma = this.store.preferences().locale.slice(0, 2).toLowerCase();
    return this.opciones.find((opcion) => opcion.value.startsWith(idioma))?.value ?? 'es-CO';
  });

  elegir(locale: string): Promise<void> {
    return this.tutorial.cambiarIdioma(locale);
  }
}
