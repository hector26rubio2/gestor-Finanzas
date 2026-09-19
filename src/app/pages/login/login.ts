import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { applyTheme, AppStore, Preferences } from '../../core/store';
import { RemoteBootstrap } from '../../core/remote-bootstrap';
import { IconComponent } from '../../ui/icon';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { I18nService } from '../../core/i18n';
import { FinanceApiClient } from '../../core/api-client';
import { firstValueFrom } from 'rxjs';
@Component({
  standalone: true,
  imports: [FormsModule, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private remote = inject(RemoteBootstrap);
  private location = inject(Location);
  private api = inject(FinanceApiClient);
  readonly i18n = inject(I18nService);
  selectedLocale = this.store.preferences().locale;
  selectedTheme = this.store.preferences().theme;
  readonly languages: readonly UiOption[] = [
    { value: 'es-CO', label: 'Español (Colombia)' },
    { value: 'en-US', label: 'English (United States)' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'fr-FR', label: 'Français' },
  ];
  readonly themes: readonly UiOption[] = [
    { value: 'system', label: 'Automático', description: 'Sigue la configuración del dispositivo' },
    { value: 'light', label: 'Luz editorial' },
    { value: 'dark', label: 'Noche índigo' },
    { value: 'ocean', label: 'Azul profundo' },
    { value: 'sand', label: 'Marfil cálido' },
    { value: 'berry', label: 'Ciruela' },
  ];
  login(index: number) {
    this.store.user.set(this.store.users[index]);
    this.store.rememberDemoSession(index);
    void this.router.navigateByUrl('/dashboard');
  }
  theme(value: string) {
    const theme = value as Preferences['theme'];
    this.store.preferences.update((p) => ({ ...p, theme }));
    applyTheme(theme);
  }
  locale(locale: string) {
    this.store.preferences.update((preferences) => ({ ...preferences, locale }));
    document.documentElement.lang = locale.slice(0, 2);
  }
  googleLoginUrl(): string {
    // Antes se mandaba `window.location.href` -la URL de esta misma pantalla de
    // login-, así que un callback exitoso volvía derecho al login en vez de al
    // dashboard: el navegador solo estaba obedeciendo a dónde se le dijo que
    // volviera. `prepareExternalUrl` respeta el base-href del build (local sirve
    // en «/», el despliegue en «/gestor-Finanzas/»), así que no hay que adivinarlo.
    const returnUrl = encodeURIComponent(`${window.location.origin}${this.location.prepareExternalUrl('/dashboard')}`);
    return `${this.store.runtime.apiBaseUrl}/api/v1/auth/google?returnUrl=${returnUrl}`;
  }
  retry(): void {
    void this.remote.initialize();
  }

  readonly localAccessEnabled = this.store.runtime.apiBaseUrl?.includes('localhost') ?? false;

  async localLogin(): Promise<void> {
    await firstValueFrom(this.api.devLogin('admin'));
    await this.remote.initialize();
    if (this.store.user()) await this.router.navigateByUrl('/dashboard');
  }
}
