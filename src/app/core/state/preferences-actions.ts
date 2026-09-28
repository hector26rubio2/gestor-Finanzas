import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '@core/api/api-client';
import { I18nService } from '@core/i18n';
import { P } from '@core/session/permissions';
import { AppStore } from './store';
import {
  DEFAULT_PALETTE,
  Preferences,
  TemaPropio,
  aplicarPaleta,
  applyTheme as aplicarTemaBase,
  clearPaletteOverrides,
  esColorOscuro,
  paletteOverrides,
} from './theme';

@Injectable({ providedIn: 'root' })
export class PreferencesActions {
  private readonly store = inject(AppStore);
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);

  usarTema(theme: Preferences['theme']): void {
    this.store.preferences.update((p) => ({
      ...p,
      theme,
      accent: DEFAULT_PALETTE.accent,
      primary: DEFAULT_PALETTE.primary,
      secondary: DEFAULT_PALETTE.secondary,
      text: DEFAULT_PALETTE.text,
      surface: DEFAULT_PALETTE.surface,
      border: DEFAULT_PALETTE.border,
      background: DEFAULT_PALETTE.background,
      name: p.customSaved?.name ?? DEFAULT_PALETTE.name,
      radius: DEFAULT_PALETTE.radius,
      custom: false,
    }));
    clearPaletteOverrides();
    aplicarTemaBase(theme);
    this.guardarPreferenciasEnSegundoPlano();
  }

  usarTemaPropio(tema: TemaPropio): void {
    const base = esColorOscuro(tema.background) ? 'dark' : 'light';
    this.store.preferences.update((p) => ({
      ...p,
      ...tema,
      accent: tema.primary,
      theme: base,
      custom: true,
      customSaved: tema,
    }));
    aplicarTemaBase(base);
    aplicarPaleta({ ...tema, accent: tema.primary, custom: true });
    this.guardarPreferenciasEnSegundoPlano();
  }

  private guardarPreferenciasEnSegundoPlano(): void {
    void this.persistPreferences().catch((error) =>
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('preferences.saveError')),
    );
  }

  async persistPreferences() {
    const value = this.store.preferences();
    const puedeTemaPropio = !!this.store.user()?.capabilities.includes(P.preferencias.tema.editar);
    await firstValueFrom(
      this.injector.get(FinanceApiClient).updatePreferences({
        language: value.locale,
        theme: value.theme,
        font: value.font,
        density: value.density,
        baseCurrency: this.store.baseCurrency(),
        customThemeJson: puedeTemaPropio ? JSON.stringify(paletteOverrides(value)) : null,
      }),
    );
  }
}
