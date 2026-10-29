import { Component, computed, inject } from '@angular/core';
import { I18nService } from '@core/i18n';
import { PreferencesActions } from '@core/state/preferences-actions';
import { AppStore } from '@core/state/store';
import { SegmentedComponent, type SegmentedOption } from '@ui/segmented';

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
  private readonly preferencias = inject(PreferencesActions);
  readonly opciones = IDIOMAS_DEL_TUTORIAL;
  readonly actual = computed(() => {
    const idioma = this.store.preferences().locale.slice(0, 2).toLowerCase();
    return this.opciones.find((opcion) => opcion.value.startsWith(idioma))?.value ?? 'es-CO';
  });

  async elegir(locale: string): Promise<void> {
    this.store.preferences.update((valor) => ({ ...valor, locale }));
    await this.i18n.load(locale);
    try {
      await this.preferencias.persistPreferences();
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('preferences.saveError'));
    }
  }
}
