import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { ApiAuthMethods, FinanceApiClient } from '@core/api';
import { ApiRequestError } from '@core/http';
import { applyTheme, AppStore, Preferences } from '@core/state';
import { RemoteBootstrap, safeReturnPath } from '@core/session';
import { IconComponent } from '@ui/icon';
import { UiOption, UiSelectComponent } from '@ui/select';
import { I18nService } from '@core/i18n';
@Component({
  imports: [FormsModule, HlmButton, HlmInput, HlmLabel, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class LoginComponent {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private remote = inject(RemoteBootstrap);
  private location = inject(Location);
  private api = inject(FinanceApiClient);
  readonly i18n = inject(I18nService);
  readonly methods = signal<ApiAuthMethods | null>(null);
  readonly showGoogle = computed(() => this.methods()?.google ?? true);
  readonly showPassword = computed(() => this.methods()?.password ?? false);
  readonly passwordError = signal('');
  readonly signingIn = signal(false);
  userName = '';
  password = '';

  constructor() {
    void this.loadMethods();
  }

  private async loadMethods(): Promise<void> {
    try {
      this.methods.set(await firstValueFrom(this.api.authMethods()));
    } catch {
      this.methods.set(null);
    }
  }

  async loginWithPassword(): Promise<void> {
    if (this.signingIn()) return;
    this.passwordError.set('');
    if (!this.userName.trim() || !this.password) {
      this.passwordError.set(this.i18n.t('login.password.required'));
      return;
    }
    this.signingIn.set(true);
    try {
      await firstValueFrom(this.api.loginWithPassword(this.userName.trim(), this.password));
      this.password = '';
      window.location.assign(`${window.location.origin}${this.location.prepareExternalUrl(this.returnPath())}`);
    } catch (error) {
      this.password = '';
      this.passwordError.set(this.passwordErrorMessage(error));
      this.signingIn.set(false);
    }
  }

  private passwordErrorMessage(error: unknown): string {
    const status = error instanceof ApiRequestError ? error.status : 0;
    if (status === 401) return this.i18n.t('login.password.invalid');
    if (status === 429) return this.i18n.t('login.password.tooMany');
    if (status === 404 || status === 503) return this.i18n.t('login.password.unavailable');
    return this.i18n.t('login.password.failed');
  }
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
  private returnPath(): string {
    return safeReturnPath(this.route.snapshot.queryParamMap.get('returnUrl')) ?? '/dashboard';
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
    const returnUrl = encodeURIComponent(
      `${window.location.origin}${this.location.prepareExternalUrl(this.returnPath())}`,
    );
    return `${this.store.runtime.apiBaseUrl}/api/v1/auth/google?returnUrl=${returnUrl}`;
  }
  retry(): void {
    void this.remote.initialize();
  }
}
